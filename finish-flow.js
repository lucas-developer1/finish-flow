/**
 * Finish Flow v2.0.0 - Smart Multi-Step Form System for Webflow
 * Production Version - Clean, Fast, Stable
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
      ...options
    };
    
    this.state = {
      currentStep: 0,
      formData: {},
      initialized: false
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
  
 init() {
  this.form.classList.add('finish-flow-initialized');
  
  // Initial visibility update (without restored data)
  this.updateVisibility();
  
  // Load progress (will call updateVisibility AGAIN with restored data)
  const restored = this.loadProgress();
  
  if (!restored) {
    this.state.currentStep = 0;
  }
  
  this.setupEventListeners();
  this.setupAutoAdvance();
  this.render();
  this.state.initialized = true;
}

  
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
      return !step.hasAttribute('data-conditional-hidden');
    });
  }
  
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
      this.saveProgress();
    } else {
      this.showSubmitButton();
    }
  }
  
  prevStep() {
    if (this.state.currentStep > 0) {
      this.state.currentStep--;
      this.render();
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
  
  console.log('--- SAVE PROGRESS ---');
  console.log('currentStep (index):', this.state.currentStep);
  console.log('visibleSteps count:', this.visibleSteps.length);
  
  const currentStepElement = this.visibleSteps[this.state.currentStep];
  const stepAttr = currentStepElement ? currentStepElement.getAttribute('data-form-step') : null;
  
  console.log('Current step element:', currentStepElement);
  console.log('Step attribute:', stepAttr);
  console.log('formData:', this.state.formData);
  
  const progressData = {
    step: this.state.currentStep,
    stepAttr: stepAttr,
    data: this.state.formData,
    timestamp: Date.now(),
    version: '2.0.0'
  };
  
  console.log('Saving:', progressData);
  
  try {
    localStorage.setItem(this.storageKey, JSON.stringify(progressData));
    console.log('✅ Saved to localStorage');
  } catch (e) {
    console.error('❌ Failed to save progress:', e);
  }
}

  
loadProgress() {
  if (!this.config.saveProgress) return false;
  
  try {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) return false;
    
    const progressData = JSON.parse(saved);
    const { step, stepAttr, data, timestamp } = progressData;
    
    const hoursAgo = (Date.now() - timestamp) / 1000 / 60 / 60;
    if (hoursAgo > this.config.progressExpiry) {
      this.clearProgress();
      return false;
    }
    
    if (this.config.confirmRestore) {
      if (!confirm('Möchten Sie mit Ihrem gespeicherten Fortschritt fortfahren?')) {
        this.clearProgress();
        return false;
      }
    }
    
    // PHASE 1: Restore formData and fields
    this.state.formData = data;
    this.restoreFormFields();
    
    // PHASE 2: Update visibility WITH restored data
    // This is CRITICAL for conditional steps!
    this.updateVisibility();
    
    // PHASE 3: Find correct step
    if (stepAttr) {
      // Find step by attribute value
      const targetStep = this.visibleSteps.find(s => 
        s.getAttribute('data-form-step') === stepAttr
      );
      
      if (targetStep) {
        this.state.currentStep = this.visibleSteps.indexOf(targetStep);
      } else {
        // Step not found (maybe conditional hidden), fallback
        this.state.currentStep = Math.min(step, this.visibleSteps.length - 1);
      }
    } else {
      // Old format: use index
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
    if (this.elements.progressBar) {
      const progress = ((this.state.currentStep + 1) / this.visibleSteps.length) * 100;
      this.elements.progressBar.style.width = progress + '%';
    }
    
    if (this.elements.stepIndicator) {
      this.elements.stepIndicator.textContent = 
        `Schritt ${this.state.currentStep + 1} von ${this.visibleSteps.length}`;
    }
    
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
}

window.FinishFlow = FinishFlow;

document.addEventListener('DOMContentLoaded', function() {
  const autoInitForms = document.querySelectorAll('[data-finish-flow][data-auto-init]');
  
  autoInitForms.forEach(form => {
    if (!form.id) {
      form.id = 'form_' + Math.random().toString(36).substr(2, 9);
    }
    
    new FinishFlow('#' + form.id);
  });
});
