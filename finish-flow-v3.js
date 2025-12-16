/**
 * Finish Flow v3.1.1 - Smart Multi-Step Form System for Webflow
 * NEW: A/B Testing Support
 * Backwards Compatible with v2.0
 * Author: Your Name
 * License: MIT
 */

class FinishFlow {
  constructor(formSelector, options = {}) {
    this.form = document.querySelector(formSelector);
    
    if (!this.form) {
      console.error('❌ FinishFlow: Form not found:', formSelector);
      return;
    }
    
this.config = {
  autoSaveDelay: 500,
  autoAdvanceDelay: 100,
  progressExpiry: 24,
  confirmRestore: false,
  saveProgress: true,
  animations: true,
  debug: false,
  onSubmit: null,
  updateURL: true, // ← NEU: URL Step Tracking
  // A/B Testing Config
  abSplit: [50, 50], // A, B percentages (or [33, 33, 34] for A/B/C)
  ...options
};

    
    this.state = {
      currentStep: 0,
      formData: {},
      initialized: false
    };
    
    // A/B Testing State
    this.abTest = {
      enabled: false,
      testName: null,
      variant: null,
      variants: [] // ['A', 'B'] or ['A', 'B', 'C']
    };
    
    this.elements = {
      steps: Array.from(this.form.querySelectorAll('[data-form-step]')),
      nextButtons: this.form.querySelectorAll('[data-next-button]'),
      prevButtons: this.form.querySelectorAll('[data-prev-button]'),
      progressBar: this.form.querySelector('[data-progress-bar]'),
      stepIndicator: this.form.querySelector('[data-step-indicator]'),
      stepNumbers: this.form.querySelectorAll('[data-step-number]')
    };
    
    this.storageKey = 'finish_flow_' + (this.form.id || 'form');
    this.submissionMode = this.detectSubmissionMode();
    this.visibleSteps = [];
    
    if (this.elements.steps.length === 0) {
      console.error('❌ FinishFlow: No steps found. Add [data-form-step] attributes.');
      return;
    }
    
    this.init();
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  init() {
    this.form.classList.add('finish-flow-initialized');
    
    // NEW V3: Check for A/B Testing
    this.initABTest();
    
    // Original V2 init flow
    this.updateVisibility();
    
    const restored = this.loadProgress();
    if (!restored) {
      this.state.currentStep = 0;
    }
    
this.setupEventListeners();
this.setupAutoAdvance();
this.render();
this.updateURL(); // ← NEU
this.state.initialized = true;

if (this.config.debug) {
  console.log('✅ FinishFlow v3.1 initialized', {
    abTest: this.abTest.enabled ? `${this.abTest.testName} (${this.abTest.variant})` : 'disabled'
  });
}
  }
  
  // ============================================
  // A/B TESTING MODULE (NEW V3)
  // ============================================
  
  initABTest() {
    // Check if A/B Test is enabled
    const testName = this.form.getAttribute('data-ab-test');
    
    if (!testName) {
      // No A/B Test - skip all A/B logic
      return;
    }
    
    this.abTest.enabled = true;
    this.abTest.testName = testName;
    
    // Detect available variants from form
    this.detectVariants();
    
    if (this.abTest.variants.length === 0) {
      console.warn('⚠️ A/B Test enabled but no variants found. Add data-variant attributes.');
      this.abTest.enabled = false;
      return;
    }
    
    // 1. Check URL Parameter (highest priority)
    const urlVariant = this.getURLVariant();
    
    if (urlVariant && this.abTest.variants.includes(urlVariant)) {
      this.abTest.variant = urlVariant;
      this.saveVariant();
      
      if (this.config.debug) {
        console.log('🔗 A/B Test: URL forced variant:', urlVariant);
      }
    } else {
      // 2. Check saved variant (Cookie/LocalStorage)
      this.abTest.variant = this.loadVariant();
      
      if (!this.abTest.variant || !this.abTest.variants.includes(this.abTest.variant)) {
        // 3. Assign new variant
        this.abTest.variant = this.assignVariant();
        this.saveVariant();
        
        if (this.config.debug) {
          console.log('🎲 A/B Test: New variant assigned:', this.abTest.variant);
        }
      } else {
        if (this.config.debug) {
          console.log('♻️ A/B Test: Returning user variant:', this.abTest.variant);
        }
      }
    }
    
    // Apply variant (hide non-matching elements)
    this.applyVariant();
    
    // Set data attribute on form for external tracking
    this.form.setAttribute('data-ab-variant', this.abTest.variant);
    document.body.setAttribute('data-ab-variant', this.abTest.variant);
  }
  
  detectVariants() {
    // Find all unique variants in form
    const variantElements = this.form.querySelectorAll('[data-variant]');
    const variantsSet = new Set();
    
    variantElements.forEach(el => {
      const variant = el.getAttribute('data-variant').toUpperCase();
      variantsSet.add(variant);
    });
    
    this.abTest.variants = Array.from(variantsSet).sort();
    
    if (this.config.debug) {
      console.log('🔍 Detected variants:', this.abTest.variants);
    }
  }
  
  getURLVariant() {
    const params = new URLSearchParams(window.location.search);
    const variant = params.get('variant');
    return variant ? variant.toUpperCase() : null;
  }
  
  assignVariant() {
    // Support A/B or A/B/C/D testing
    const variants = this.abTest.variants;
    const splits = this.config.abSplit;
    
    // Normalize splits to percentages
    let normalizedSplits = splits;
    const sum = splits.reduce((a, b) => a + b, 0);
    
    if (sum !== 100) {
      // Auto-normalize if not 100
      normalizedSplits = splits.map(s => (s / sum) * 100);
    }
    
    // Ensure we have enough splits for variants
    while (normalizedSplits.length < variants.length) {
      normalizedSplits.push(100 / variants.length);
    }
    
    // Roll the dice
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < variants.length; i++) {
      cumulative += normalizedSplits[i];
      if (random < cumulative) {
        return variants[i];
      }
    }
    
    // Fallback (should never happen)
    return variants[0];
  }
  
  saveVariant() {
    if (!this.abTest.enabled) return;
    
    const key = `ab_${this.abTest.testName}`;
    const value = this.abTest.variant;
    
    // Save to Cookie (30 days)
    try {
      document.cookie = `${key}=${value}; max-age=${30*24*60*60}; path=/; SameSite=Lax`;
    } catch (e) {
      console.warn('⚠️ Could not set cookie:', e);
    }
    
    // Save to LocalStorage (fallback)
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('⚠️ Could not set localStorage:', e);
    }
  }
  
  loadVariant() {
    if (!this.abTest.enabled) return null;
    
    const key = `ab_${this.abTest.testName}`;
    
    // Try Cookie first
    try {
      const cookies = document.cookie.split('; ');
      const cookie = cookies.find(row => row.startsWith(key + '='));
      
      if (cookie) {
        return cookie.split('=')[1];
      }
    } catch (e) {
      console.warn('⚠️ Could not read cookie:', e);
    }
    
    // Fallback to LocalStorage
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('⚠️ Could not read localStorage:', e);
    }
    
    return null;
  }
  
  applyVariant() {
    if (!this.abTest.enabled) return;
    
    // Find all elements with data-variant
    const variantElements = this.form.querySelectorAll('[data-variant]');
    
    variantElements.forEach(el => {
      const elVariant = el.getAttribute('data-variant').toUpperCase();
      
      if (elVariant !== this.abTest.variant) {
        // Wrong variant - hide it
        el.style.display = 'none';
        el.setAttribute('data-ab-hidden', 'true');
        
        // If it's a step, mark as conditional hidden
        if (el.hasAttribute('data-form-step')) {
          el.setAttribute('data-conditional-hidden', 'true');
        }
      } else {
        // Correct variant - ensure it's not hidden by A/B
        el.removeAttribute('data-ab-hidden');
      }
    });
  }

// ============================================
// V3.1: URL STEP TRACKING
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
      variant: this.abTest.variant,
      formData: this.state.formData
    }
  }));
  
  if (this.config.debug) {
    console.log('🔗 URL updated:', stepId);
  }
}


  
  // ============================================
  // ORIGINAL V2 FUNCTIONS (unchanged)
  // ============================================
  
  detectSubmissionMode() {
    if (this.form.hasAttribute('data-name') || this.form.classList.contains('w-form')) {
      return 'webflow';
    }
    if (this.form.hasAttribute('data-webhook-url')) {
      return 'webhook';
    }
    if (this.config.onSubmit) {
      return 'custom';
    }
    return 'none';
  }
  
  updateVisibility() {
    this.captureStepData();
    
    this.elements.steps.forEach((step) => {
      // Skip if already hidden by A/B Test
      if (step.hasAttribute('data-ab-hidden')) {
        return;
      }
      
      const showIf = step.getAttribute('data-show-if');
      const hideIf = step.getAttribute('data-hide-if');
      
      let shouldShow = true;
      
      if (showIf) {
        shouldShow = this.evaluateCondition(showIf);
      }
      
      if (hideIf && shouldShow) {
        shouldShow = !this.evaluateCondition(hideIf);
      }
      
      if (shouldShow) {
        step.removeAttribute('data-conditional-hidden');
      } else {
        step.setAttribute('data-conditional-hidden', 'true');
      }
    });
    
    this.updateVisibleSteps();
  }
  
  evaluateCondition(condition) {
    const conditions = condition.split(',').map(c => c.trim());
    
    return conditions.every(cond => {
      const [fieldName, expectedValue] = cond.split('=').map(s => s.trim());
      const actualValue = String(this.state.formData[fieldName] || '');
      return actualValue === expectedValue;
    });
  }
  
  updateVisibleSteps() {
    this.visibleSteps = this.elements.steps.filter(step => {
      return !step.hasAttribute('data-conditional-hidden') && 
             !step.hasAttribute('data-ab-hidden');
    });
  }
  
  captureStepData() {
    const inputs = this.form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (!input.name) return;
      
      // Skip if in hidden A/B variant
      const parentStep = input.closest('[data-form-step]');
      if (parentStep && parentStep.hasAttribute('data-ab-hidden')) {
        return;
      }
      
      if (input.type === 'checkbox') {
        this.state.formData[input.name] = input.checked;
      } else if (input.type === 'radio') {
        if (input.checked) {
          this.state.formData[input.name] = input.value;
        }
      } else {
        this.state.formData[input.name] = input.value;
      }
    });
  }
  
  nextStep() {
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    
    if (!this.validateStep(currentStepElement)) {
      return;
    }
    
    this.captureStepData();
    this.updateVisibility();
    
if (this.state.currentStep < this.visibleSteps.length - 1) {
  this.state.currentStep++;
  this.render();
  this.updateURL(); // ← NEU
  this.saveProgress();
} else {
  this.showSubmitButton();
}

  }
  
prevStep() {
  if (this.state.currentStep > 0) {
    this.state.currentStep--;
    this.render();
    this.updateURL(); // ← NEU
    this.saveProgress();
  }
}

  
  render() {
    this.elements.steps.forEach(step => {
      step.style.display = 'none';
    });
    
    const currentStep = this.visibleSteps[this.state.currentStep];
    
    if (currentStep) {
      currentStep.style.display = 'block';
      
      if (this.config.animations) {
        currentStep.style.animation = 'none';
        setTimeout(() => {
          currentStep.style.animation = 'finishFlowFadeIn 0.25s ease-in';
        }, 10);
      }
      
      const firstInput = currentStep.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
    
    this.updateProgressIndicators();
  }
  
  showSubmitButton() {
    const submitBtn = this.form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.style.display = 'block';
      submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  setupAutoAdvance() {
    const autoAdvanceSteps = this.form.querySelectorAll('[data-auto-advance="true"]');
    
    autoAdvanceSteps.forEach(step => {
      // Skip if hidden by A/B Test
      if (step.hasAttribute('data-ab-hidden')) {
        return;
      }
      
      const radios = step.querySelectorAll('input[type="radio"]');
      const selects = step.querySelectorAll('select');
      
      radios.forEach(radio => {
        radio.addEventListener('change', () => {
          this.addVisualFeedback(radio);
          
          setTimeout(() => {
            this.captureStepData();
            this.updateVisibility();
            this.nextStep();
          }, this.config.autoAdvanceDelay);
        }, true);
      });
      
      selects.forEach(select => {
        select.addEventListener('change', () => {
          setTimeout(() => {
            this.captureStepData();
            this.updateVisibility();
            this.nextStep();
          }, this.config.autoAdvanceDelay + 50);
        });
      });
    });
  }
  
  addVisualFeedback(element) {
    const container = element.closest('label') || element.parentElement;
    if (container) {
      container.classList.add('finish-flow-selected');
      
      const siblings = container.parentElement?.querySelectorAll('.finish-flow-selected');
      siblings?.forEach(sibling => {
        if (sibling !== container) {
          sibling.classList.remove('finish-flow-selected');
        }
      });
    }
  }
  
  saveProgress() {
    if (!this.config.saveProgress) return;
    
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    const stepAttr = currentStepElement ? currentStepElement.getAttribute('data-form-step') : null;
    
    const progressData = {
      stepAttr: stepAttr,
      step: this.state.currentStep,
      data: this.state.formData,
      timestamp: Date.now(),
      version: '3.0.0',
      // NEW V3: Save A/B variant
      abVariant: this.abTest.enabled ? this.abTest.variant : null
    };
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(progressData));
    } catch (e) {
      console.error('❌ Failed to save progress:', e);
    }
  }
  
  loadProgress() {
    if (!this.config.saveProgress) return false;
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reset') === 'true') {
        this.clearProgress();
        window.history.replaceState({}, '', window.location.pathname);
        return false;
      }
      
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return false;
      
      const progressData = JSON.parse(saved);
      const { stepAttr, step, data, timestamp, version, abVariant } = progressData;
      
      // Version check (accept 2.0.0 and 3.0.0)
      if (version && !['2.0.0', '3.0.0'].includes(version)) {
        console.warn('⚠️ Old version detected, clearing progress');
        this.clearProgress();
        return false;
      }
      
      const hoursAgo = (Date.now() - timestamp) / 1000 / 60 / 60;
      if (hoursAgo > this.config.progressExpiry) {
        this.clearProgress();
        return false;
      }
      
      if (!data || typeof data !== 'object') {
        console.warn('⚠️ Corrupted data detected, clearing progress');
        this.clearProgress();
        return false;
      }
      
      if (this.config.confirmRestore) {
        if (!confirm('Möchten Sie mit Ihrem gespeicherten Fortschritt fortfahren?')) {
          this.clearProgress();
          return false;
        }
      }
      
      // NEW V3: Check if saved A/B variant matches current
      if (this.abTest.enabled && abVariant && abVariant !== this.abTest.variant) {
        if (this.config.debug) {
          console.log('⚠️ A/B variant changed, clearing progress');
        }
        this.clearProgress();
        return false;
      }
      
      // Restore formData and fields
      this.state.formData = data;
      this.restoreFormFields();
      
      // Update visibility with restored data
      this.updateVisibility();
      
      // Find correct step
      if (stepAttr) {
        const targetStep = this.visibleSteps.find(s => 
          s.getAttribute('data-form-step') === stepAttr
        );
        
        if (targetStep) {
          this.state.currentStep = this.visibleSteps.indexOf(targetStep);
        } else {
          this.state.currentStep = Math.min(step, this.visibleSteps.length - 1);
        }
      } else {
        this.state.currentStep = Math.min(step, this.visibleSteps.length - 1);
      }
      
      return true;
      
    } catch (e) {
      console.error('❌ Failed to load progress:', e);
      this.clearProgress();
      return false;
    }
  }
  
  restoreFormFields() {
    Object.entries(this.state.formData).forEach(([name, value]) => {
      const fields = this.form.querySelectorAll(`[name="${name}"]`);
      
      fields.forEach(field => {
        // Skip if in hidden A/B variant
        const parentStep = field.closest('[data-form-step]');
        if (parentStep && parentStep.hasAttribute('data-ab-hidden')) {
          return;
        }
        
        if (field.type === 'radio' || field.type === 'checkbox') {
          field.checked = (field.value === value || value === true);
        } else {
          field.value = value;
        }
      });
    });
  }
  
  clearProgress() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.error('❌ Failed to clear progress:', e);
    }
  }
  
  validateStep(stepElement) {
    const requiredFields = stepElement.querySelectorAll('[required]');
    let isValid = true;
    const errors = [];
    
    stepElement.querySelectorAll('.finish-flow-error').forEach(el => {
      el.classList.remove('finish-flow-error');
    });
    
    requiredFields.forEach(field => {
      let fieldValid = true;
      
      if (field.type === 'radio') {
        const group = stepElement.querySelectorAll(`input[name="${field.name}"]`);
        fieldValid = Array.from(group).some(r => r.checked);
        
        if (!fieldValid) {
          group.forEach(r => r.parentElement?.classList.add('finish-flow-error'));
          errors.push(`Bitte wählen Sie eine Option für "${field.name}"`);
        }
        
      } else if (field.type === 'checkbox') {
        fieldValid = field.checked;
        if (!fieldValid) {
          field.parentElement?.classList.add('finish-flow-error');
          errors.push(`Bitte bestätigen Sie "${field.name}"`);
        }
        
      } else {
        fieldValid = field.value.trim() !== '';
        if (!fieldValid) {
          field.classList.add('finish-flow-error');
          errors.push(`Bitte füllen Sie "${field.name}" aus`);
        }
      }
      
      if (!fieldValid) isValid = false;
    });
    
    const errorElement = stepElement.querySelector('[data-error-message]');
    if (errorElement) {
      if (!isValid) {
        errorElement.style.display = 'block';
        errorElement.textContent = errors[0] || 'Bitte füllen Sie alle Pflichtfelder aus';
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        errorElement.style.display = 'none';
      }
    }
    
    return isValid;
  }
  
updateProgressIndicators() {
  const totalSteps = this.visibleSteps.length;
  const currentStepNumber = this.state.currentStep + 1;
  const progress = (currentStepNumber / totalSteps) * 100;
  
  // ===== SYSTEM 1: Standard Finish Flow (data-progress-bar) =====
  if (this.elements.progressBar) {
    this.elements.progressBar.style.width = progress + '%';
  }
  
  // ===== SYSTEM 2: Custom Finish Flow (data-progress-bar-finish) =====
  // ✅ NEU: Findet ALLE Progress Bars (auch die in versteckten Steps)
  const allCustomProgressBars = document.querySelectorAll('[data-progress-bar-finish]');
  
  if (allCustomProgressBars.length > 0) {
    allCustomProgressBars.forEach(bar => {
      bar.style.width = progress + '%';
      bar.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    });
    
    // Debug Log (optional)
    if (this.config.debug) {
      console.log(`📊 ${allCustomProgressBars.length} Progress Bars updated:`, progress + '%', `(${currentStepNumber}/${totalSteps})`);
    }
  }
  
  // ===== Step Indicator Text =====
  if (this.elements.stepIndicator) {
    this.elements.stepIndicator.textContent = `Schritt ${currentStepNumber} von ${totalSteps}`;
  }
  
  // ===== Step Indicator Text (alle Instanzen) =====
  const allStepIndicators = document.querySelectorAll('[data-step-indicator]');
  if (allStepIndicators.length > 0) {
    allStepIndicators.forEach(indicator => {
      indicator.textContent = `Schritt ${currentStepNumber} von ${totalSteps}`;
    });
  }
  
  // ===== Step Numbers (Dots/Circles) =====
  this.elements.stepNumbers.forEach((num, index) => {
    num.classList.remove('active', 'completed');
    
    if (index === this.state.currentStep) {
      num.classList.add('active');
    } else if (index < this.state.currentStep) {
      num.classList.add('completed');
    }
  });
}


  
  setupEventListeners() {
    this.elements.nextButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.nextStep();
      });
    });
    
    this.elements.prevButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.prevStep();
      });
    });
    
    this.form.addEventListener('input', this.debounce(() => {
      this.captureStepData();
      this.updateVisibility();
      this.saveProgress();
    }, this.config.autoSaveDelay));
    
    this.form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        const isAutoAdvance = e.target.hasAttribute('data-auto-advance') || 
                            e.target.closest('[data-auto-advance]');
        
        if (!isAutoAdvance) {
          e.preventDefault();
          this.nextStep();
        }
      }
    });
    
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(e);
    });
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    this.captureStepData();
    this.clearProgress();
    
    if (this.submissionMode === 'webflow') {
      this.form.submit();
      
    } else if (this.submissionMode === 'webhook' || this.submissionMode === 'custom') {
      try {
        const result = await this.customSubmit();
        
        if (result.success) {
          this.showSuccess();
        } else {
          this.showError(result.message);
        }
      } catch (error) {
        console.error('❌ Submission failed:', error);
        this.showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
      }
    }
  }
  
  async customSubmit() {
    const webhookUrl = this.form.getAttribute('data-webhook-url');
    
    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state.formData)
      });
      
      return {
        success: response.ok,
        message: response.ok ? 'Erfolgreich gesendet!' : 'Fehler beim Senden'
      };
    }
    
    const customHandler = this.config.onSubmit;
    if (typeof customHandler === 'function') {
      return await customHandler(this.state.formData);
    }
    
    return { success: true, message: 'Daten erfasst' };
  }
  
  showSuccess() {
    const successElement = this.form.querySelector('[data-success-message]') || 
                          this.form.querySelector('.w-form-done');
    
    if (successElement) {
      this.elements.steps.forEach(step => step.style.display = 'none');
      successElement.style.display = 'block';
    } else {
      alert('Vielen Dank! Ihre Anfrage wurde erfolgreich gesendet.');
    }
  }
  
  showError(message) {
    const errorElement = this.form.querySelector('[data-form-error]') ||
                        this.form.querySelector('.w-form-fail');
    
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    } else {
      alert(message);
    }
  }
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // ============================================
  // PUBLIC API
  // ============================================
  
goToStep(stepNumber) {
  if (stepNumber >= 0 && stepNumber < this.visibleSteps.length) {
    this.state.currentStep = stepNumber;
    this.render();
    this.updateURL(); // ← NEU
    this.saveProgress();
  } else {
    console.error('❌ Invalid step number:', stepNumber);
  }
}

  
reset() {
  this.state.currentStep = 0;
  this.state.formData = {};
  this.clearProgress();
  this.form.reset();
  this.updateVisibility();
  this.render();
  this.updateURL(); // ← NEU
}

  
  getData() {
    this.captureStepData();
    return { ...this.state.formData };
  }
  
  setData(data) {
    this.state.formData = { ...this.state.formData, ...data };
    this.restoreFormFields();
    this.updateVisibility();
    this.saveProgress();
  }
  
  destroy() {
    this.form.classList.remove('finish-flow-initialized');
  }
  
  // ============================================
  // A/B TESTING HELPER FUNCTIONS (NEW V3)
  // ============================================
  
  getVariant() {
    return this.abTest.enabled ? this.abTest.variant : null;
  }
  
  setVariant(variant) {
    if (!this.abTest.enabled) {
      console.warn('⚠️ A/B Testing is not enabled for this form');
      return false;
    }
    
    const upperVariant = variant.toUpperCase();
    
    if (!this.abTest.variants.includes(upperVariant)) {
      console.error('❌ Invalid variant:', variant, 'Available:', this.abTest.variants);
      return false;
    }
    
    // Update variant
    this.abTest.variant = upperVariant;
    this.saveVariant();
    
    // Reapply variant (hide/show elements)
    this.applyVariant();
    this.updateVisibility();
    
    // Reset to step 0 (fresh start with new variant)
    this.state.currentStep = 0;
    this.clearProgress();
    this.render();
    
    // Update data attributes
    this.form.setAttribute('data-ab-variant', this.abTest.variant);
    document.body.setAttribute('data-ab-variant', this.abTest.variant);
    
    if (this.config.debug) {
      console.log('✅ Variant changed to:', upperVariant);
    }
    
    return true;
  }
  
  resetVariant() {
    if (!this.abTest.enabled) {
      console.warn('⚠️ A/B Testing is not enabled for this form');
      return false;
    }
    
    // Assign new variant
    this.abTest.variant = this.assignVariant();
    this.saveVariant();
    
    // Reapply and reset
    this.applyVariant();
    this.updateVisibility();
    this.state.currentStep = 0;
    this.clearProgress();
    this.render();
    
    // Update data attributes
    this.form.setAttribute('data-ab-variant', this.abTest.variant);
    document.body.setAttribute('data-ab-variant', this.abTest.variant);
    
    if (this.config.debug) {
      console.log('🎲 Variant reset to:', this.abTest.variant);
    }
    
    return this.abTest.variant;
  }
}

// ============================================
// GLOBAL HELPER FUNCTIONS (NEW V3)
// ============================================

window.FinishFlow = FinishFlow;

// Global helper to get variant for a specific test
window.FinishFlow.getVariant = function(testName) {
  const key = `ab_${testName}`;
  
  // Try cookie
  const cookies = document.cookie.split('; ');
  const cookie = cookies.find(row => row.startsWith(key + '='));
  if (cookie) {
    return cookie.split('=')[1];
  }
  
  // Try localStorage
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

// Global helper to set variant for a specific test
window.FinishFlow.setVariant = function(testName, variant) {
  const key = `ab_${testName}`;
  const value = variant.toUpperCase();
  
  // Set cookie
  try {
    document.cookie = `${key}=${value}; max-age=${30*24*60*60}; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn('⚠️ Could not set cookie:', e);
  }
  
  // Set localStorage
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('⚠️ Could not set localStorage:', e);
  }
  
  console.log(`✅ Variant set: ${testName} = ${value} (reload page to apply)`);
};

// Global helper to reset variant (re-roll)
window.FinishFlow.resetVariant = function(testName) {
  const key = `ab_${testName}`;
  
  // Delete cookie
  try {
    document.cookie = `${key}=; max-age=0; path=/`;
  } catch (e) {
    console.warn('⚠️ Could not delete cookie:', e);
  }
  
  // Delete localStorage
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('⚠️ Could not delete localStorage:', e);
  }
  
  console.log(`✅ Variant reset: ${testName} (reload page to get new variant)`);
};

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const autoInitForms = document.querySelectorAll('[data-finish-flow][data-auto-init]');
  
  autoInitForms.forEach(form => {
    if (!form.id) {
      form.id = 'form_' + Math.random().toString(36).substr(2, 9);
    }
    
    new FinishFlow('#' + form.id);
  });
  
  console.log('✅ Finish Flow v3.0.0 loaded');
});
