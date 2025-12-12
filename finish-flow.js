/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                    FINISH FLOW v2.0.0                           ║
 * ║          Smart Multi-Step Form System for Webflow               ║
 * ║                                                                  ║
 * ║  Features:                                                       ║
 * ║  • Works with OR without Webflow Form element                   ║
 * ║  • Conditional Logic (show-if/hide-if)                          ║
 * ║  • Auto-Advance (Radio/Select)                                  ║
 * ║  • Progress Persistence                                         ║
 * ║  • Custom Submission Handling                                   ║
 * ║  • Robust & Production-Ready                                    ║
 * ║                                                                  ║
 * ║  License: MIT                                                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function(window) {
  'use strict';

  /**
   * Main FinishFlow Class
   */
  class FinishFlow {
    constructor(selector, options = {}) {
      // Find container (can be form or div)
      this.container = typeof selector === 'string' 
        ? document.querySelector(selector) 
        : selector;

      if (!this.container) {
        console.error('[FinishFlow] Container not found:', selector);
        return;
      }

      // Default options
      this.options = {
        // Core
        debug: false,
        animations: true,
        
        // Progress
        saveProgress: true,
        progressKey: null, // Auto-generated if null
        progressExpiryHours: 24,
        confirmRestore: true,
        
        // Submission
        submissionMode: 'auto', // 'auto', 'webflow', 'webhook', 'custom'
        webhookUrl: null,
        webhookMethod: 'POST',
        
        // Callbacks
        onInit: null,
        onStepChange: null,
        onSubmit: null,
        onSubmitSuccess: null,
        onSubmitError: null,
        
        ...options
      };

      // State
      this.state = {
        currentStepIndex: 0,
        formData: {},
        visibleSteps: [],
        isSubmitting: false,
        initialized: false
      };

      // Elements cache
      this.elements = {
        steps: [],
        nextButtons: [],
        prevButtons: [],
        submitButtons: [],
        progressBar: null,
        stepIndicator: null,
        stepNumbers: []
      };

      // Initialize
      this.init();
    }

    /**
     * ══════════════════════════════════════════════════════════
     * INITIALIZATION
     * ══════════════════════════════════════════════════════════
     */
    
    init() {
      this.log('🚀 Initializing FinishFlow v2.0');
      
      // Detect submission mode
      this.detectSubmissionMode();
      
      // Cache elements
      this.cacheElements();
      
      // Validate setup
      if (!this.validate()) {
        return;
      }
      
      // Setup
      this.setupStorage();
      this.setupEventListeners();
      this.setupAutoAdvance();
      
      // Load saved progress
      if (this.options.saveProgress) {
        this.loadProgress();
      }
      
      // Initial render
      this.updateVisibility();
      this.render();
      
      // Mark as initialized
      this.state.initialized = true;
      this.container.classList.add('ff-initialized');
      
      this.log('✅ FinishFlow initialized', {
        steps: this.elements.steps.length,
        mode: this.options.submissionMode
      });
      
      // Callback
      if (this.options.onInit) {
        this.options.onInit(this);
      }
    }

    detectSubmissionMode() {
      if (this.options.submissionMode !== 'auto') {
        return; // User specified
      }

      // Auto-detect
      if (this.container.tagName === 'FORM') {
        this.options.submissionMode = 'webflow';
        this.log('📝 Detected: Webflow Form');
      } else if (this.options.webhookUrl) {
        this.options.submissionMode = 'webhook';
        this.log('🔗 Detected: Webhook Mode');
      } else {
        this.options.submissionMode = 'custom';
        this.log('⚙️ Detected: Custom Mode');
      }
    }

    cacheElements() {
      // Steps
      this.elements.steps = Array.from(
        this.container.querySelectorAll('[data-form-step]')
      );

      // Buttons
      this.elements.nextButtons = Array.from(
        this.container.querySelectorAll('[data-next-button]')
      );
      
      this.elements.prevButtons = Array.from(
        this.container.querySelectorAll('[data-prev-button]')
      );

      // Submit buttons (both types)
      this.elements.submitButtons = Array.from(
        this.container.querySelectorAll('[data-submit-button], [type="submit"]')
      );

      // UI Indicators
      this.elements.progressBar = this.container.querySelector('[data-progress-bar]');
      this.elements.stepIndicator = this.container.querySelector('[data-step-indicator]');
      this.elements.stepNumbers = Array.from(
        this.container.querySelectorAll('[data-step-number]')
      );

      this.log('📦 Elements cached', {
        steps: this.elements.steps.length,
        nextButtons: this.elements.nextButtons.length,
        prevButtons: this.elements.prevButtons.length,
        submitButtons: this.elements.submitButtons.length
      });
    }

    validate() {
      if (this.elements.steps.length === 0) {
        console.error('[FinishFlow] No steps found! Add [data-form-step] attributes.');
        return false;
      }

      // Check step numbers
      const stepNumbers = this.elements.steps.map(s => s.getAttribute('data-form-step'));
      const uniqueNumbers = new Set(stepNumbers);
      
      if (stepNumbers.length !== uniqueNumbers.size) {
        console.warn('[FinishFlow] Duplicate step numbers detected. This may cause issues.');
      }

      return true;
    }

    /**
     * ══════════════════════════════════════════════════════════
     * STATE MANAGEMENT
     * ══════════════════════════════════════════════════════════
     */

    captureData() {
      const currentStep = this.getCurrentStep();
      if (!currentStep) return;

      const inputs = currentStep.querySelectorAll('input, select, textarea');
      
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

      this.log('📊 Data captured', this.state.formData);
    }

    getAllData() {
      // Capture current step data
      this.captureData();
      
      // Return copy
      return { ...this.state.formData };
    }

    /**
     * ══════════════════════════════════════════════════════════
     * VISIBILITY & CONDITIONAL LOGIC
     * ══════════════════════════════════════════════════════════
     */

    updateVisibility() {
      this.log('👁️ Updating visibility');

      // Evaluate all conditional steps
      this.elements.steps.forEach(step => {
        const showIf = step.getAttribute('data-show-if');
        const hideIf = step.getAttribute('data-hide-if');

        let shouldShow = true;

        // Check show-if
        if (showIf) {
          shouldShow = this.evaluateCondition(showIf);
        }

        // Check hide-if
        if (hideIf && shouldShow) {
          shouldShow = !this.evaluateCondition(hideIf);
        }

        // Apply visibility
        if (shouldShow) {
          step.removeAttribute('data-ff-hidden');
        } else {
          step.setAttribute('data-ff-hidden', 'true');
        }
      });

      // Update visible steps list
      this.state.visibleSteps = this.elements.steps.filter(
        step => !step.hasAttribute('data-ff-hidden')
      );

      this.log('✅ Visible steps:', this.state.visibleSteps.length);
    }

    evaluateCondition(conditionString) {
      const conditions = conditionString.split(',').map(c => c.trim());
      
      // AND logic (all must match)
      return conditions.every(condition => {
        const [fieldName, expectedValue] = condition.split('=').map(s => s.trim());
        const actualValue = this.state.formData[fieldName];
        
        return String(actualValue) === String(expectedValue);
      });
    }

    /**
     * ══════════════════════════════════════════════════════════
     * NAVIGATION
     * ══════════════════════════════════════════════════════════
     */

    getCurrentStep() {
      return this.state.visibleSteps[this.state.currentStepIndex] || null;
    }

    goToStep(index) {
      if (index < 0 || index >= this.state.visibleSteps.length) {
        this.log('❌ Invalid step index:', index);
        return false;
      }

      this.log(`🎯 Going to step ${index}`);
      
      this.state.currentStepIndex = index;
      this.render();
      
      return true;
    }

    nextStep() {
      this.log('➡️ Next step requested');

      // Validate current step
      if (!this.validateCurrentStep()) {
        this.log('❌ Validation failed');
        return false;
      }

      // Capture data
      this.captureData();

      // Update visibility (conditionals may have changed)
      this.updateVisibility();

      // Check if there's a next step
      const nextIndex = this.state.currentStepIndex + 1;

      if (nextIndex < this.state.visibleSteps.length) {
        this.goToStep(nextIndex);
      } else {
        this.log('🏁 Last step reached');
        this.showSubmitButtons();
      }

      return true;
    }

    prevStep() {
      this.log('⬅️ Previous step requested');

      const prevIndex = this.state.currentStepIndex - 1;

      if (prevIndex >= 0) {
        this.goToStep(prevIndex);
      } else {
        this.log('⚠️ Already at first step');
      }

      return true;
    }

    /**
     * ══════════════════════════════════════════════════════════
     * RENDERING
     * ══════════════════════════════════════════════════════════
     */

    render() {
      this.log('🎨 Rendering');

      // Hide all steps
      this.elements.steps.forEach(step => {
        step.style.display = 'none';
      });

      // Show current step
      const currentStep = this.getCurrentStep();
      if (currentStep) {
        currentStep.style.display = 'block';

        // Animation
        if (this.options.animations) {
          currentStep.style.animation = 'none';
          setTimeout(() => {
            currentStep.style.animation = 'ffFadeIn 0.3s ease';
          }, 10);
        }

        // Scroll into view
        if (this.state.currentStepIndex > 0) {
          this.container.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }

        // Focus first input
        const firstInput = currentStep.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) {
          setTimeout(() => firstInput.focus(), 100);
        }
      }

      // Update UI
      this.updateProgressIndicators();
      this.hideSubmitButtons();

      // Save progress
      if (this.options.saveProgress) {
        this.saveProgress();
      }

      // Callback
      if (this.options.onStepChange) {
        this.options.onStepChange(this.state.currentStepIndex, currentStep);
      }
    }

    updateProgressIndicators() {
      const total = this.state.visibleSteps.length;
      const current = this.state.currentStepIndex + 1;
      const progress = (current / total) * 100;

      // Progress bar
      if (this.elements.progressBar) {
        this.elements.progressBar.style.width = `${progress}%`;
      }

      // Step indicator text
      if (this.elements.stepIndicator) {
        this.elements.stepIndicator.textContent = `Schritt ${current} von ${total}`;
      }

      // Step numbers
      this.elements.stepNumbers.forEach((num, index) => {
        num.classList.remove('active', 'completed');
        
        if (index === this.state.currentStepIndex) {
          num.classList.add('active');
        } else if (index < this.state.currentStepIndex) {
          num.classList.add('completed');
        }

        // Hide if beyond visible steps
        if (index >= total) {
          num.style.display = 'none';
        } else {
          num.style.display = '';
        }
      });
    }

    showSubmitButtons() {
      this.elements.submitButtons.forEach(btn => {
        btn.style.display = '';
      });
    }

    hideSubmitButtons() {
      this.elements.submitButtons.forEach(btn => {
        btn.style.display = 'none';
      });
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
      
    } else if (this.submissionMode === 'custom') {
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
      this.hideAllSteps();
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
  
  // Go to specific step
  goToStep(stepNumber) {
    if (stepNumber >= 0 && stepNumber < this.visibleSteps.length) {
      this.state.currentStep = stepNumber;
      this.render();
      this.saveProgress();
    } else {
      console.error('❌ Invalid step number:', stepNumber);
    }
  }
  
  // Reset form
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
  
  // Get current data
  getData() {
    this.captureStepData();
    return { ...this.state.formData };
  }
  
  // Set data programmatically
  setData(data) {
    this.state.formData = { ...this.state.formData, ...data };
    this.restoreFormFields();
    this.updateVisibility();
    this.saveProgress();
  }
  
  // Destroy instance
  destroy() {
    this.form.classList.remove('finish-flow-initialized');
    // Remove event listeners, etc.
    if (this.config.debug) {
      console.log('🗑️ FinishFlow destroyed');
    }
  }
}

// ============================================
// GLOBAL INITIALIZATION
// ============================================

// Make FinishFlow available globally
window.FinishFlow = FinishFlow;

// Auto-initialize forms
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

