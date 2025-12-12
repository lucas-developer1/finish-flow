/**
 * Finish Flow v2.0.0 - Smart Multi-Step Form System for Webflow
 * Clean rebuild - stable, maintainable, performant
 * Author: Your Name
 * License: MIT
 */

class FinishFlow {
  constructor(formSelector, options = {}) {
    // Find form
    this.form = document.querySelector(formSelector);
    
    if (!this.form) {
      console.error('❌ FinishFlow: Form not found:', formSelector);
      return;
    }
    
    // Configuration
    this.config = {
      autoSaveDelay: 500,
      autoAdvanceDelay: 100,
      progressExpiry: 24,
      confirmRestore: true,
      saveProgress: true,
      animations: true,
      debug: false,
      onSubmit: null,
      ...options
    };
    
    // State
    this.state = {
      currentStep: 0,
      formData: {},
      initialized: false
    };
    
    // Cache elements
    this.elements = {
      steps: Array.from(this.form.querySelectorAll('[data-form-step]')),
      nextButtons: this.form.querySelectorAll('[data-next-button]'),
      prevButtons: this.form.querySelectorAll('[data-prev-button]'),
      progressBar: this.form.querySelector('[data-progress-bar]'),
      stepIndicator: this.form.querySelector('[data-step-indicator]'),
      stepNumbers: this.form.querySelectorAll('[data-step-number]')
    };
    
    // Storage key
    this.storageKey = 'finish_flow_' + (this.form.id || 'form');
    
    // Submission mode detection
    this.submissionMode = this.detectSubmissionMode();
    
    // Visible steps cache
    this.visibleSteps = [];
    
    // Validation
    if (this.elements.steps.length === 0) {
      console.error('❌ FinishFlow: No steps found. Add [data-form-step] attributes.');
      return;
    }
    
    if (this.config.debug) {
      console.log('🚀 FinishFlow v2.0 initialized:', {
        formId: this.form.id,
        steps: this.elements.steps.length,
        mode: this.submissionMode,
        config: this.config
      });
    }
    
    // Initialize
    this.init();
  }
  
  // ============================================
  // 1. INITIALIZATION
  // ============================================
  
  init() {
    // Mark as initialized
    this.form.classList.add('finish-flow-initialized');
    
    // Initial visibility update
    this.updateVisibility();
    
    // Try to restore progress
    const restored = this.loadProgress();
    
    // If not restored, start from step 0
    if (!restored) {
      this.state.currentStep = 0;
    }
    
    // Setup
    this.setupEventListeners();
    this.setupAutoAdvance();
    
    // Initial render
    this.render();
    
    // Mark as ready
    this.state.initialized = true;
    
    if (this.config.debug) {
      console.log('✅ FinishFlow ready. Starting at step:', this.state.currentStep);
    }
  }
  
  detectSubmissionMode() {
    // Check if it's a Webflow form
    if (this.form.hasAttribute('data-name') || this.form.classList.contains('w-form')) {
      return 'webflow';
    }
    
    // Check for webhook
    if (this.form.hasAttribute('data-webhook-url')) {
      return 'webhook';
    }
    
    // Check for custom handler
    if (this.config.onSubmit) {
      return 'custom';
    }
    
    return 'none';
  }
  
  // ============================================
  // 2. VISIBILITY & CONDITIONAL LOGIC
  // ============================================
  
  updateVisibility() {
    if (this.config.debug) {
      console.log('🔍 Evaluating conditional visibility...');
    }
    
    // Capture current form data
    this.captureStepData();
    
    // Process all steps
    this.elements.steps.forEach((step, index) => {
      const showIf = step.getAttribute('data-show-if');
      const hideIf = step.getAttribute('data-hide-if');
      
      let shouldShow = true;
      
      // Evaluate show-if
      if (showIf) {
        shouldShow = this.evaluateCondition(showIf);
        
        if (this.config.debug) {
          console.log(`Step ${index}: show-if="${showIf}" → ${shouldShow}`);
        }
      }
      
      // Evaluate hide-if
      if (hideIf && shouldShow) {
        shouldShow = !this.evaluateCondition(hideIf);
        
        if (this.config.debug) {
          console.log(`Step ${index}: hide-if="${hideIf}" → ${!shouldShow}`);
        }
      }
      
      // Apply visibility
      if (shouldShow) {
        step.removeAttribute('data-conditional-hidden');
      } else {
        step.setAttribute('data-conditional-hidden', 'true');
      }
    });
    
    // Update visible steps cache
    this.updateVisibleSteps();
  }
  
  evaluateCondition(condition) {
    // Support multiple conditions: "field1=value1,field2=value2"
    const conditions = condition.split(',').map(c => c.trim());
    
    return conditions.every(cond => {
      const [fieldName, expectedValue] = cond.split('=').map(s => s.trim());
      const actualValue = String(this.state.formData[fieldName] || '');
      
      return actualValue === expectedValue;
    });
  }
  
  updateVisibleSteps() {
    this.visibleSteps = this.elements.steps.filter(step => {
      return !step.hasAttribute('data-conditional-hidden');
    });
    
    if (this.config.debug) {
      console.log('👁️ Visible steps:', this.visibleSteps.length, '/', this.elements.steps.length);
    }
  }
  
  // ============================================
  // 3. DATA CAPTURE
  // ============================================
  
  captureStepData() {
    const inputs = this.form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (!input.name) return;
      
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
    
    if (this.config.debug) {
      console.log('📦 Form data captured:', this.state.formData);
    }
  }
  
  // ============================================
  // 4. NAVIGATION
  // ============================================
  
  nextStep() {
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    
    // Validate current step
    if (!this.validateStep(currentStepElement)) {
      if (this.config.debug) {
        console.log('❌ Validation failed, staying on step', this.state.currentStep);
      }
      return;
    }
    
    // Capture data
    this.captureStepData();
    
    // Update visibility (in case conditions changed)
    this.updateVisibility();
    
    // Find next visible step
    if (this.state.currentStep < this.visibleSteps.length - 1) {
      this.state.currentStep++;
      this.render();
      this.saveProgress();
      
      if (this.config.debug) {
        console.log('➡️ Advanced to step', this.state.currentStep);
      }
    } else {
      // Last step - show submit button
      this.showSubmitButton();
      
      if (this.config.debug) {
        console.log('✅ Reached last step');
      }
    }
  }
  
  prevStep() {
    if (this.state.currentStep > 0) {
      this.state.currentStep--;
      this.render();
      this.saveProgress();
      
      if (this.config.debug) {
        console.log('⬅️ Went back to step', this.state.currentStep);
      }
    }
  }
  
  render() {
    // Hide all steps
    this.elements.steps.forEach(step => {
      step.style.display = 'none';
    });
    
    // Show current visible step
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
      
      // Scroll to form top
      if (this.state.currentStep > 0) {
        this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      // Focus first input
      const firstInput = currentStep.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
    
    // Update progress indicators
    this.updateProgressIndicators();
  }
  
  showSubmitButton() {
    const submitBtn = this.form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.style.display = 'block';
      submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  // ============================================
  // 5. AUTO-ADVANCE SYSTEM
  // ============================================
  
  setupAutoAdvance() {
    const autoAdvanceSteps = this.form.querySelectorAll('[data-auto-advance="true"]');
    
    if (this.config.debug) {
      console.log('🚀 Setting up auto-advance for', autoAdvanceSteps.length, 'steps');
    }
    
    autoAdvanceSteps.forEach(step => {
      const radios = step.querySelectorAll('input[type="radio"]');
      const selects = step.querySelectorAll('select');
      
      // Radio buttons
      radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (this.config.debug) {
            console.log('📻 Radio changed:', e.target.name, '=', e.target.value);
          }
          
          // Visual feedback
          this.addVisualFeedback(radio);
          
          // Auto-advance after short delay
          setTimeout(() => {
            this.captureStepData();
            this.updateVisibility();
            this.nextStep();
          }, this.config.autoAdvanceDelay);
        }, true); // useCapture = true
      });
      
      // Select dropdowns
      selects.forEach(select => {
        select.addEventListener('change', (e) => {
          if (this.config.debug) {
            console.log('📝 Select changed:', e.target.name, '=', e.target.value);
          }
          
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
      
      // Remove from siblings
      const siblings = container.parentElement?.querySelectorAll('.finish-flow-selected');
      siblings?.forEach(sibling => {
        if (sibling !== container) {
          sibling.classList.remove('finish-flow-selected');
        }
      });
    }
  }
  
  // ============================================
  // 6. PROGRESS SYSTEM (LocalStorage)
  // ============================================
  
  saveProgress() {
    if (!this.config.saveProgress) return;
    
    const progressData = {
      step: this.state.currentStep,
      data: this.state.formData,
      timestamp: Date.now(),
      version: '2.0.0'
    };
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(progressData));
      
      if (this.config.debug) {
        console.log('💾 Progress saved:', progressData);
      }
    } catch (e) {
      console.error('❌ Failed to save progress:', e);
    }
  }
  
  loadProgress() {
    if (!this.config.saveProgress) return false;
    
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return false;
      
      const { step, data, timestamp } = JSON.parse(saved);
      
      // Check expiry
      const hoursAgo = (Date.now() - timestamp) / 1000 / 60 / 60;
      if (hoursAgo > this.config.progressExpiry) {
        this.clearProgress();
        return false;
      }
      
      // Ask user if they want to restore
      if (this.config.confirmRestore) {
        if (!confirm('Möchten Sie mit Ihrem gespeicherten Fortschritt fortfahren?')) {
          this.clearProgress();
          return false;
        }
      }
      
      // Restore state
      this.state.currentStep = step;
      this.state.formData = data;
      this.restoreFormFields();
      
      if (this.config.debug) {
        console.log('✅ Progress restored:', { step, data });
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
      if (this.config.debug) {
        console.log('🗑️ Progress cleared');
      }
    } catch (e) {
      console.error('❌ Failed to clear progress:', e);
    }
  }
  
  // ============================================
  // 7. VALIDATION SYSTEM
  // ============================================
  
  validateStep(stepElement) {
    const requiredFields = stepElement.querySelectorAll('[required]');
    let isValid = true;
    const errors = [];
    
    // Clear previous errors
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
    
    // Show/hide error message
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
    
    if (this.config.debug && !isValid) {
      console.log('❌ Validation failed:', errors);
    }
    
    return isValid;
  }
  
  // ============================================
  // 8. PROGRESS INDICATORS
  // ============================================
  
  updateProgressIndicators() {
    // Progress bar
    if (this.elements.progressBar) {
      const progress = ((this.state.currentStep + 1) / this.visibleSteps.length) * 100;
      this.elements.progressBar.style.width = progress + '%';
    }
    
    // Step indicator
    if (this.elements.stepIndicator) {
      this.elements.stepIndicator.textContent = 
        `Schritt ${this.state.currentStep + 1} von ${this.visibleSteps.length}`;
    }
    
    // Step numbers
    this.elements.stepNumbers.forEach((num, index) => {
      num.classList.remove('active', 'completed');
      
      if (index === this.state.currentStep) {
        num.classList.add('active');
      } else if (index < this.state.currentStep) {
        num.classList.add('completed');
      }
    });
  }
  
  // ============================================
  // 9. EVENT LISTENERS
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
    this.form.addEventListener('input', this.debounce(() => {
      this.captureStepData();
      this.updateVisibility();
      this.saveProgress();
    }, this.config.autoSaveDelay));
    
    // Keyboard navigation
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
    
    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(e);
    });
  }
  
  // ============================================
  // 10. FORM SUBMISSION
  // ============================================
  
  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.config.debug) {
      console.log('📨 Form submitted. Mode:', this.submissionMode);
      console.log('📦 Form data:', this.state.formData);
    }
    
    // Capture final data
    this.captureStepData();
    
    // Clear progress
    this.clearProgress();
    
    // Handle based on mode
    if (this.submissionMode === 'webflow') {
      // Let Webflow handle it
      this.form.submit();
      
    } else if (this.submissionMode === 'webhook' || this.submissionMode === 'custom') {
      // Custom handling
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
    // Check for webhook URL
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
    
    // Check for custom function
    const customHandler = this.config.onSubmit;
    if (typeof customHandler === 'function') {
      return await customHandler(this.state.formData);
    }
    
    // Default: just log
    console.log('✅ Form data ready:', this.state.formData);
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
  
  // ============================================
  // 11. HELPER UTILITIES
  // ============================================
  
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
  // 12. PUBLIC API
  // ============================================
  
  goToStep(stepNumber) {
    if (stepNumber >= 0 && stepNumber < this.visibleSteps.length) {
      this.state.currentStep = stepNumber;
      this.render();
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
    
    if (this.config.debug) {
      console.log('🔄 Form reset');
    }
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
    if (this.config.debug) {
      console.log('🗑️ FinishFlow destroyed');
    }
  }
}

// ============================================
// GLOBAL INITIALIZATION
// ============================================

window.FinishFlow = FinishFlow;

document.addEventListener('DOMContentLoaded', function() {
  const autoInitForms = document.querySelectorAll('[data-finish-flow][data-auto-init]');
  
  autoInitForms.forEach(form => {
    if (!form.id) {
      form.id = 'form_' + Math.random().toString(36).substr(2, 9);
    }
    
    new FinishFlow('#' + form.id);
  });
  
  console.log('✅ Finish Flow v2.0.0 loaded');
});
