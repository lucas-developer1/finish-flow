/**
 * Finish Flow v3.1.0 - Smart Multi-Step Form System for Webflow
 * NEW: URL Step Tracking + Custom Button IDs
 * 
 * Features:
 * - Multi-Step Navigation with Conditional Logic
 * - Auto-Save & Restore Progress (LocalStorage, 24h expiry)
 * - A/B Testing System (Multi-Variant Support)
 * - URL Step Tracking (Retention Graphs)
 * - Custom Button/Radio IDs (Granular Tracking)
 * - Auto-Advance (Radio, Select)
 * - Form Validation
 * - Progress Indicators
 * - Keyboard Navigation
 * - Mobile Optimized
 * 
 * (c) 2025 | Production Ready | Open Source
 * CDN: https://finish-flow-one.vercel.app/finish-flow-v3.js
 */

class FinishFlow {
  constructor(formSelector, options = {}) {
    this.form = typeof formSelector === 'string' 
      ? document.querySelector(formSelector) 
      : formSelector;
    
    if (!this.form) {
      console.error('Finish Flow: Form not found');
      return;
    }

    // Configuration
    this.config = {
      autoSaveDelay: 500,
      autoAdvanceDelay: 100,
      progressExpiry: 24,
      confirmRestore: false,
      saveProgress: true,
      animations: true,
      updateURL: true, // ← V3.1: URL Step Tracking
      keyboardNav: true,
      preloadNextStep: true,
      ...options
    };

    // State
    this.state = {
      currentStep: 0,
      formData: {},
      initialized: false,
      isSubmitting: false
    };

    // Cache DOM elements
    this.elements = {
      steps: Array.from(this.form.querySelectorAll('[data-form-step]')),
      nextButtons: Array.from(this.form.querySelectorAll('[data-next-button]')),
      prevButtons: Array.from(this.form.querySelectorAll('[data-prev-button]')),
      submitButton: this.form.querySelector('[type="submit"]'),
      progressBar: this.form.querySelector('[data-progress-bar]'),
      stepIndicator: this.form.querySelector('[data-step-indicator]'),
      stepNumbers: Array.from(this.form.querySelectorAll('[data-step-number]')),
      resetButton: this.form.querySelector('[data-form-reset]')
    };

    // Visible steps (after conditional logic + A/B test)
    this.visibleSteps = [];

    // Generate unique storage key per form AND page
    const formId = this.form.id || 'form_' + Math.random().toString(36).substr(2, 9);
    const customKey = this.form.getAttribute('data-form-key');
    const pagePath = window.location.pathname.replace(/\//g, '_') || 'home';

    this.storageKey = 'finish_flow_' + (customKey || formId + '_' + pagePath);

    // V3.0: A/B Testing
    this.abTest = {
      testName: this.form.getAttribute('data-ab-test'),
      variant: null,
      variants: []
    };

    // Auto-save timer
    this.saveTimeout = null;

    // Initialize
    if (this.form.hasAttribute('data-auto-init')) {
      this.init();
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  
  init() {
    this.form.classList.add('finish-flow-initialized');
    
    // V3.0: Initialize A/B Test first (if present)
    if (this.abTest.testName) {
      this.initABTest();
    }
    
    // Load progress FIRST (restores formData)
    const restored = this.loadProgress();
    
    // THEN update visibility (with restored data!)
    this.updateVisibility();
    
    // If nothing was restored, start at 0
    if (!restored) {
      this.state.currentStep = 0;
    }
    
    this.setupEventListeners();
    this.setupAutoAdvance();
    this.setupKeyboardNavigation();
    this.setupResetButton();
    
    this.render();
    
    this.state.initialized = true;
    
    // V3.1: Update URL on init
    this.updateURL();
  }

  // ============================================
  // V3.0: A/B TESTING MODULE
  // ============================================
  
  initABTest() {
    // Load existing variant or assign new one
    let variant = this.loadVariant();
    
    // Check for URL override (?variant=A)
    const urlParams = new URLSearchParams(window.location.search);
    const urlVariant = urlParams.get('variant');
    
    if (urlVariant) {
      variant = urlVariant.toUpperCase();
      this.saveVariant(variant); // Override permanent
      
      // Clean URL
      urlParams.delete('variant');
      const newUrl = window.location.pathname + 
        (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }
    
    if (!variant) {
      variant = this.assignVariant();
      this.saveVariant(variant);
    }
    
    this.abTest.variant = variant;
    this.applyVariant(variant);
  }
  
  assignVariant() {
    // Find all variants for this test
    const variants = Array.from(
      new Set(
        this.elements.steps
          .filter(step => step.hasAttribute('data-variant'))
          .map(step => step.getAttribute('data-variant'))
      )
    );
    
    this.abTest.variants = variants;
    
    if (variants.length === 0) {
      return null;
    }
    
    // Check for custom split (data-ab-split="70,30")
    const customSplit = this.form.getAttribute('data-ab-split');
    
    if (customSplit && variants.length === 2) {
      const [splitA, splitB] = customSplit.split(',').map(s => parseInt(s.trim()));
      const random = Math.random() * 100;
      return random < splitA ? variants[0] : variants[1];
    }
    
    // Default: Equal split (50/50 or 33/33/33, etc.)
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
  }
  
  saveVariant(variant) {
    const key = 'finish_flow_ab_' + this.abTest.testName;
    const data = {
      variant: variant,
      timestamp: Date.now()
    };
    
    // Cookie (30 days)
    document.cookie = `${key}=${variant}; path=/; max-age=${30 * 24 * 60 * 60}`;
    
    // LocalStorage fallback
    localStorage.setItem(key, JSON.stringify(data));
  }
  
  loadVariant() {
    const key = 'finish_flow_ab_' + this.abTest.testName;
    
    // Try Cookie first
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === key) {
        return value;
      }
    }
    
    // Fallback to LocalStorage
    try {
      const data = JSON.parse(localStorage.getItem(key));
      return data ? data.variant : null;
    } catch (e) {
      return null;
    }
  }
  
  applyVariant(variant) {
    // Hide all non-matching variants
    this.elements.steps.forEach(step => {
      const stepVariant = step.getAttribute('data-variant');
      
      if (stepVariant && stepVariant !== variant) {
        step.setAttribute('data-ab-hidden', 'true');
        step.style.display = 'none';
      } else if (stepVariant === variant) {
        step.removeAttribute('data-ab-hidden');
      }
    });
    
    // Set variant on form and body for external tracking
    this.form.setAttribute('data-ab-variant', variant);
    document.body.setAttribute('data-ab-variant', variant);
  }

  // ============================================
  // V3.1: URL TRACKING
  // ============================================
  
  updateURL() {
    if (!this.config.updateURL) return;
    
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    if (!currentStepElement) return;
    
    // Priority: data-step-id > data-form-step
    const stepId = currentStepElement.getAttribute('data-step-id') 
                || currentStepElement.getAttribute('data-form-step');
    
    if (!stepId) return;
    
    // Update URL without page reload
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('step', stepId);
    
    const newUrl = window.location.pathname + '?' + urlParams.toString();
    
    // Use replaceState to avoid browser history pollution
    window.history.replaceState(
      { step: stepId }, 
      '', 
      newUrl
    );
    
    // Trigger custom event for external tracking
    window.dispatchEvent(new CustomEvent('finishflow:step', {
      detail: {
        stepId: stepId,
        stepIndex: this.state.currentStep,
        totalSteps: this.visibleSteps.length,
        variant: this.abTest.variant
      }
    }));
  }

  // ============================================
  // STEP NAVIGATION
  // ============================================
  
  updateVisibility() {
    this.visibleSteps = this.elements.steps.filter(step => {
      // Check if hidden by A/B test
      if (step.getAttribute('data-ab-hidden') === 'true') {
        return false;
      }
      
      // Check conditional logic
      const showIf = step.getAttribute('data-show-if');
      const hideIf = step.getAttribute('data-hide-if');
      
      if (showIf) {
        const conditions = showIf.split(',').map(c => c.trim());
        const allMet = conditions.every(condition => {
          const [field, value] = condition.split('=').map(s => s.trim());
          return this.state.formData[field] === value;
        });
        
        if (!allMet) {
          step.style.display = 'none';
          return false;
        }
      }
      
      if (hideIf) {
        const conditions = hideIf.split(',').map(c => c.trim());
        const anyMet = conditions.some(condition => {
          const [field, value] = condition.split('=').map(s => s.trim());
          return this.state.formData[field] === value;
        });
        
        if (anyMet) {
          step.style.display = 'none';
          return false;
        }
      }
      
      return true;
    });
    
    // Adjust currentStep if it's out of bounds
    if (this.state.currentStep >= this.visibleSteps.length) {
      this.state.currentStep = Math.max(0, this.visibleSteps.length - 1);
    }
  }
  
  goToStep(index) {
    if (index < 0 || index >= this.visibleSteps.length) {
      return;
    }
    
    this.state.currentStep = index;
    this.render();
    this.saveProgress();
    
    // V3.1: Update URL
    this.updateURL();
  }
  
  nextStep() {
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    
    if (!this.validateStep(currentStepElement)) {
      return;
    }
    
    if (this.state.currentStep < this.visibleSteps.length - 1) {
      this.state.currentStep++;
      this.updateVisibility();
      this.render();
      this.saveProgress();
      
      // V3.1: Update URL
      this.updateURL();
      
      // Preload next step (performance)
      if (this.config.preloadNextStep && this.state.currentStep < this.visibleSteps.length - 1) {
        this.preloadStep(this.state.currentStep + 1);
      }
    }
  }
  
  prevStep() {
    if (this.state.currentStep > 0) {
      this.state.currentStep--;
      this.render();
      this.saveProgress();
      
      // V3.1: Update URL
      this.updateURL();
    }
  }
  
  preloadStep(stepIndex) {
    const nextStep = this.visibleSteps[stepIndex];
    if (!nextStep) return;
    
    // Preload images
    const images = nextStep.querySelectorAll('img[data-src]');
    images.forEach(img => {
      img.src = img.getAttribute('data-src');
    });
  }

  // ============================================
  // RENDERING
  // ============================================
  
  render() {
    // Hide all steps
    this.elements.steps.forEach(step => {
      step.style.display = 'none';
    });
    
    // Show current step
    const currentStep = this.visibleSteps[this.state.currentStep];
    
    if (currentStep) {
      currentStep.style.display = 'block';
      
      // Animation
      if (this.config.animations) {
        currentStep.style.animation = 'none';
        setTimeout(() => {
          currentStep.style.animation = 'finishFlowFadeIn 0.25s ease-in';
        }, 10);
      }
      
      // Smart Scroll (Mobile only + only if not fully visible)
      if (this.state.currentStep > 0 && window.innerWidth < 768) {
        const formRect = this.form.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const isFullyVisible = (
          formRect.top >= 0 &&
          formRect.bottom <= windowHeight
        );
        
        if (!isFullyVisible) {
          this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      
      // Focus first input
      const firstInput = currentStep.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
      
      // Show/hide submit button
      if (this.elements.submitButton) {
        const isLastStep = this.state.currentStep === this.visibleSteps.length - 1;
        this.elements.submitButton.style.display = isLastStep ? 'block' : 'none';
      }
    }
    
    this.updateProgressIndicators();
  }

  // ============================================
  // VALIDATION
  // ============================================
  
  validateStep(stepElement) {
    if (!stepElement) return true;
    
    const inputs = stepElement.querySelectorAll('input, select, textarea');
    let isValid = true;
    let firstInvalidInput = null;
    
    inputs.forEach(input => {
      input.classList.remove('finish-flow-error');
      
      // Required check
      if (input.hasAttribute('required')) {
        if (input.type === 'checkbox') {
          if (!input.checked) {
            isValid = false;
            input.classList.add('finish-flow-error');
            if (!firstInvalidInput) firstInvalidInput = input;
          }
        } else if (input.type === 'radio') {
          const radioGroup = stepElement.querySelectorAll(`input[name="${input.name}"]`);
          const isChecked = Array.from(radioGroup).some(r => r.checked);
          if (!isChecked) {
            isValid = false;
            radioGroup.forEach(r => r.classList.add('finish-flow-error'));
            if (!firstInvalidInput) firstInvalidInput = input;
          }
        } else {
          if (!input.value.trim()) {
            isValid = false;
            input.classList.add('finish-flow-error');
            if (!firstInvalidInput) firstInvalidInput = input;
          }
        }
      }
      
      // Email validation
      if (input.type === 'email' && input.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value)) {
          isValid = false;
          input.classList.add('finish-flow-error');
          if (!firstInvalidInput) firstInvalidInput = input;
        }
      }
      
      // URL validation
      if (input.type === 'url' && input.value) {
        try {
          new URL(input.value);
        } catch (e) {
          isValid = false;
          input.classList.add('finish-flow-error');
          if (!firstInvalidInput) firstInvalidInput = input;
        }
      }
      
      // Number validation
      if (input.type === 'number' && input.value) {
        const min = input.getAttribute('min');
        const max = input.getAttribute('max');
        const value = parseFloat(input.value);
        
        if (min !== null && value < parseFloat(min)) {
          isValid = false;
          input.classList.add('finish-flow-error');
          if (!firstInvalidInput) firstInvalidInput = input;
        }
        
        if (max !== null && value > parseFloat(max)) {
          isValid = false;
          input.classList.add('finish-flow-error');
          if (!firstInvalidInput) firstInvalidInput = input;
        }
      }
    });
    
    // Show/hide error message
    const errorMessage = stepElement.querySelector('[data-error-message]');
    if (errorMessage) {
      errorMessage.style.display = isValid ? 'none' : 'block';
    }
    
    // Focus first invalid input
    if (!isValid && firstInvalidInput) {
      firstInvalidInput.focus();
    }
    
    return isValid;
  }

  // ============================================
  // PROGRESS INDICATORS
  // ============================================
  
  updateProgressIndicators() {
    const totalSteps = this.visibleSteps.length;
    const currentStepNumber = this.state.currentStep + 1;
    const progress = (currentStepNumber / totalSteps) * 100;
    
    // Progress Bar
    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = progress + '%';
    }
    
    // Step Indicator
    if (this.elements.stepIndicator) {
      this.elements.stepIndicator.textContent = `Schritt ${currentStepNumber} von ${totalSteps}`;
    }
    
    // Step Numbers (circles/dots)
    if (this.elements.stepNumbers.length > 0) {
      this.elements.stepNumbers.forEach((numberEl, index) => {
        numberEl.classList.remove('active', 'completed');
        
        if (index === this.state.currentStep) {
          numberEl.classList.add('active');
        } else if (index < this.state.currentStep) {
          numberEl.classList.add('completed');
        }
      });
    }
  }

  // ============================================
  // DATA CAPTURE & STORAGE
  // ============================================
  
  captureFormData() {
    const inputs = this.form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (input.type === 'radio') {
        if (input.checked) {
          this.state.formData[input.name] = input.value;
        }
      } else if (input.type === 'checkbox') {
        this.state.formData[input.name] = input.checked;
      } else if (input.type !== 'submit') {
        this.state.formData[input.name] = input.value;
      }
    });
  }
  
  restoreFormFields() {
    const inputs = this.form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const value = this.state.formData[input.name];
      
      if (value !== undefined) {
        if (input.type === 'radio') {
          input.checked = (input.value === value);
        } else if (input.type === 'checkbox') {
          input.checked = value;
        } else if (input.type !== 'submit') {
          input.value = value;
        }
      }
    });
  }
  
  saveProgress() {
    if (!this.config.saveProgress) return;
    
    this.captureFormData();
    
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    const stepAttr = currentStepElement ? currentStepElement.getAttribute('data-form-step') : '1';
    
    const progressData = {
      stepAttr: stepAttr,
      step: this.state.currentStep,
      data: this.state.formData,
      timestamp: Date.now(),
      version: '3.1.0',
      variant: this.abTest.variant
    };
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(progressData));
    } catch (e) {
      console.error('Finish Flow: Failed to save progress', e);
    }
  }
  
  loadProgress() {
    if (!this.config.saveProgress) return false;
    
    try {
      // Check for URL Parameter Reset
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reset') === 'true') {
        this.clearProgress();
        urlParams.delete('reset');
        const newUrl = window.location.pathname + 
          (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
        return false;
      }
      
      const saved = localStorage.getItem(this.storageKey);
      
      if (!saved) return false;
      
      const progressData = JSON.parse(saved);
      const { stepAttr, step, data, timestamp, version } = progressData;
      
      // SAFETY CHECK 1: Version Check
      if (version && !version.startsWith('3.') && !version.startsWith('2.')) {
        this.clearProgress();
        return false;
      }
      
      // SAFETY CHECK 2: Expiry Check (24 Hours)
      const hoursAgo = (Date.now() - timestamp) / 1000 / 60 / 60;
      if (hoursAgo > this.config.progressExpiry) {
        this.clearProgress();
        return false;
      }
      
      // SAFETY CHECK 3: Data Integrity
      if (!data || typeof data !== 'object') {
        this.clearProgress();
        return false;
      }
      
      // Optional: Confirm Restore
      if (this.config.confirmRestore) {
        if (!confirm('Möchten Sie mit Ihrem gespeicherten Fortschritt fortfahren?')) {
          this.clearProgress();
          return false;
        }
      }
      
      // Apply restore - FormData FIRST!
      this.state.formData = data;
      this.restoreFormFields();
      
      // NOW update visibility (with restored data!)
      this.updateVisibility();
      
      // RESTORE: Find correct visible step index
      let targetStepIndex = 0;
      
      if (stepAttr) {
        // Find step by data-form-step value
        const stepElement = this.elements.steps.find(s => 
          s.getAttribute('data-form-step') === stepAttr
        );
        
        if (stepElement) {
          // Check if it's in visible steps
          targetStepIndex = this.visibleSteps.indexOf(stepElement);
          
          // If hidden by conditional logic, start at beginning
          if (targetStepIndex === -1) {
            targetStepIndex = 0;
          }
        }
      } else if (typeof step === 'number') {
        // Fallback: Old format
        targetStepIndex = Math.min(step, this.visibleSteps.length - 1);
      }
      
      this.state.currentStep = targetStepIndex;
      
      return true;
      
    } catch (e) {
      console.error('Finish Flow: Failed to load progress', e);
      this.clearProgress();
      return false;
    }
  }
  
  clearProgress() {
    localStorage.removeItem(this.storageKey);
    this.state.formData = {};
    this.state.currentStep = 0;
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  
  setupEventListeners() {
    // Next buttons
    this.elements.nextButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.nextStep();
      });
    });
    
    // Previous buttons
    this.elements.prevButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.prevStep();
      });
    });
    
    // Auto-save on input
    this.form.addEventListener('input', () => {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.captureFormData();
        this.updateVisibility();
        this.saveProgress();
      }, this.config.autoSaveDelay);
    });
    
    // Form submission
    this.form.addEventListener('submit', (e) => {
      this.handleSubmit(e);
    });
  }
  
  setupAutoAdvance() {
    const autoAdvanceElements = this.form.querySelectorAll('[data-auto-advance="true"]');
    
    autoAdvanceElements.forEach(element => {
      if (element.type === 'radio') {
        element.addEventListener('change', () => {
          // Add selected class for visual feedback
          const label = element.closest('label') || element.nextElementSibling;
          if (label) {
            label.classList.add('finish-flow-selected');
          }
          
          setTimeout(() => {
            this.captureFormData();
            this.updateVisibility();
            this.nextStep();
          }, this.config.autoAdvanceDelay);
        });
        
        // Hover effect
        element.addEventListener('mouseenter', () => {
          const label = element.closest('label') || element.nextElementSibling;
          if (label) {
            label.classList.add('finish-flow-hover');
          }
        });
        
        element.addEventListener('mouseleave', () => {
          const label = element.closest('label') || element.nextElementSibling;
          if (label) {
            label.classList.remove('finish-flow-hover');
          }
        });
        
      } else if (element.tagName === 'SELECT') {
        element.addEventListener('change', () => {
          setTimeout(() => {
            this.captureFormData();
            this.updateVisibility();
            this.nextStep();
          }, this.config.autoAdvanceDelay);
        });
      }
    });
  }
  
  setupKeyboardNavigation() {
    if (!this.config.keyboardNav) return;
    
    document.addEventListener('keydown', (e) => {
      // Only handle if form is focused/visible
      if (!this.form.contains(document.activeElement)) return;
      
      // Enter key on input (not textarea)
      if (e.key === 'Enter' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.nextStep();
      }
      
      // Escape key
      if (e.key === 'Escape') {
        this.prevStep();
      }
    });
  }
  
  setupResetButton() {
    if (this.elements.resetButton) {
      this.elements.resetButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (confirm('Möchten Sie das Formular wirklich zurücksetzen?')) {
          this.reset();
        }
      });
    }
  }

  // ============================================
  // FORM SUBMISSION
  // ============================================
  
  handleSubmit(e) {
    e.preventDefault();
    
    // Prevent double submission
    if (this.state.isSubmitting) return;
    
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    
    if (!this.validateStep(currentStepElement)) {
      return;
    }
    
    this.captureFormData();
    this.state.isSubmitting = true;
    
    // Custom webhook
    const webhookUrl = this.form.getAttribute('data-webhook-url');
    if (webhookUrl) {
      this.submitToWebhook(webhookUrl);
      return;
    }
    
    // Custom handler
    if (this.config.onSubmit && typeof this.config.onSubmit === 'function') {
      this.config.onSubmit(this.state.formData);
      return;
    }
    
    // Default: Webflow form submission
    this.form.submit();
  }
  
  async submitToWebhook(url) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...this.state.formData,
          _meta: {
            variant: this.abTest.variant,
            timestamp: Date.now(),
            formId: this.form.id
          }
        })
      });
      
      if (response.ok) {
        this.showSuccessMessage();
        this.clearProgress();
      } else {
        this.showErrorMessage();
      }
    } catch (error) {
      console.error('Finish Flow: Submission failed', error);
      this.showErrorMessage();
    } finally {
      this.state.isSubmitting = false;
    }
  }
  
  showSuccessMessage() {
    const successElement = this.form.querySelector('[data-success-message]');
    if (successElement) {
      successElement.style.display = 'block';
    }
    
    this.form.style.display = 'none';
  }
  
  showErrorMessage() {
    const errorElement = this.form.querySelector('[data-form-error]');
    if (errorElement) {
      errorElement.style.display = 'block';
      
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================
  
  reset() {
    this.clearProgress();
    this.form.reset();
    this.state.formData = {};
    this.state.currentStep = 0;
    this.updateVisibility();
    this.render();
    
    // V3.1: Update URL
    this.updateURL();
  }
  
  getData() {
    return { ...this.state.formData };
  }
  
  setData(data) {
    this.state.formData = { ...this.state.formData, ...data };
    this.restoreFormFields();
    this.updateVisibility();
    this.saveProgress();
  }
  
  exportData(format = 'json') {
    const data = this.getData();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    if (format === 'csv') {
      const headers = Object.keys(data).join(',');
      const values = Object.values(data).join(',');
      return headers + '\n' + values;
    }
    
    return data;
  }
  
  destroy() {
    this.form.classList.remove('finish-flow-initialized');
    this.state.initialized = false;
  }

  // ============================================
  // V3.0: A/B TESTING - STATIC HELPERS
  // ============================================
  
  static getVariant(testName) {
    const key = 'finish_flow_ab_' + testName;
    
    // Try Cookie first
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === key) {
        return value;
      }
    }
    
    // Fallback to LocalStorage
    try {
      const data = JSON.parse(localStorage.getItem(key));
      return data ? data.variant : null;
    } catch (e) {
      return null;
    }
  }
  
  static setVariant(testName, variant) {
    const key = 'finish_flow_ab_' + testName;
    const data = {
      variant: variant,
      timestamp: Date.now()
    };
    
    // Cookie (30 days)
    document.cookie = `${key}=${variant}; path=/; max-age=${30 * 24 * 60 * 60}`;
    
    // LocalStorage fallback
    localStorage.setItem(key, JSON.stringify(data));
    
    // Reload to apply
    window.location.reload();
  }
  
  static resetVariant(testName) {
    const key = 'finish_flow_ab_' + testName;
    
    // Delete Cookie
    document.cookie = `${key}=; path=/; max-age=0`;
    
    // Delete LocalStorage
    localStorage.removeItem(key);
    
    // Reload
    window.location.reload();
  }
  
  static cleanAllData() {
    // Remove all Finish Flow data from LocalStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('finish_flow_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Remove all A/B Test cookies
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name.startsWith('finish_flow_ab_')) {
        document.cookie = `${name}=; path=/; max-age=0`;
      }
    });
  }
}

// Auto-initialize all forms with data-auto-init
document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('[data-finish-flow][data-auto-init]');
  forms.forEach(form => {
    new FinishFlow(form);
  });
});

// V3.1: Expose FinishFlow to window for external access
window.FinishFlow = FinishFlow;

