/**
 * Finish Flow - Smart Multi-Step Form System for Webflow
 * Version: 1.0.0
 * Author: Your Name
 * License: MIT
 */

class FinishFlow {
  constructor(formSelector, options = {}) {
    this.form = document.querySelector(formSelector);
    
    if (!this.form) {
      console.error('FinishFlow: Form not found:', formSelector);
      return;
    }
    
    // Default options
    this.options = {
      autoSaveDelay: 500,
      progressExpiryHours: 24,
      confirmRestore: true,
      animations: true,
      debug: false,
      ...options
    };
    
    this.steps = Array.from(this.form.querySelectorAll('[data-form-step]'));
    this.currentStep = 0;
    this.formData = {};
    this.storageKey = 'finish_flow_' + (this.form.id || 'form');
    
    if (this.steps.length === 0) {
      console.error('FinishFlow: No steps found. Add [data-form-step] attributes to your step elements.');
      return;
    }
    
    if (this.options.debug) {
      console.log('FinishFlow initialized:', {
        steps: this.steps.length,
        formId: this.form.id,
        options: this.options
      });
    }
    
    this.init();
  }
  
  init() {
    this.form.classList.add('finish-flow-initialized');
    this.hideAllSteps();
    this.loadSavedProgress();
    this.setupEventListeners();
    this.setupAutoAdvance();
    this.showStep(this.currentStep);
    this.evaluateConditionals();
  }
  
  hideAllSteps() {
    this.steps.forEach(step => {
      step.style.display = 'none';
    });
  }
  
  showStep(stepIndex) {
    this.hideAllSteps();
    
    if (this.steps[stepIndex]) {
      const step = this.steps[stepIndex];
      step.style.display = 'block';
      
      // Animation
      if (this.options.animations) {
        step.style.animation = 'none';
        setTimeout(() => {
          step.style.animation = 'finishFlowFadeIn 0.3s ease-in';
        }, 10);
      }
      
      this.currentStep = stepIndex;
      this.updateProgressIndicators();
      this.saveProgress();
      
      // Scroll to top of form
      if (stepIndex > 0) {
        this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
         // Focus first input in new step
    const firstInput = step.querySelector('input, select, textarea');
    if (firstInput && firstInput.type !== 'hidden') {
      setTimeout(() => firstInput.focus(), 100);
    }
    
    // Preload next step für bessere Performance  
    this.preloadNextStep();                   
  }
}

  
nextStep() {
  if (this.options.debug) {
    console.log('FinishFlow: nextStep() called from step', this.currentStep);
  }
  
  if (this.validateCurrentStep()) {
    this.captureStepData();
    this.evaluateConditionals();
    
    // Finde den nächsten sichtbaren Step
    let nextIndex = this.currentStep + 1;
    
    if (this.options.debug) {
      console.log('FinishFlow: Looking for next step after index', this.currentStep);
    }
    
    while (nextIndex < this.steps.length) {
      const nextStep = this.steps[nextIndex];
      
      // Checke ob Step conditional ist und versteckt
      const isConditional = nextStep.hasAttribute('data-show-if') || 
                           nextStep.hasAttribute('data-hide-if');
      const isHidden = nextStep.style.display === 'none';
      
      if (this.options.debug) {
        console.log('FinishFlow: Checking step', nextIndex, {
          stepNumber: nextStep.getAttribute('data-form-step'),
          isConditional,
          isHidden,
          display: nextStep.style.display
        });
      }
      
      if (isConditional && isHidden) {
        // Überspringe diesen Step
        nextIndex++;
        
        if (this.options.debug) {
          console.log('FinishFlow: ⏭️ Skipping conditional step', nextStep.getAttribute('data-form-step'));
        }
      } else {
        // Dieser Step kann angezeigt werden
        if (this.options.debug) {
          console.log('FinishFlow: ✅ Found next visible step at index', nextIndex);
        }
        break;
      }
    }
    
    if (nextIndex < this.steps.length) {
      if (this.options.debug) {
        console.log('FinishFlow: 🚀 Going to step', nextIndex);
      }
      this.showStep(nextIndex);
    } else {
      // Kein nächster Step mehr - zeige Submit
      if (this.options.debug) {
        console.log('FinishFlow: No more steps - showing submit button');
      }
      this.showSubmitButton();
    }
  } else {
    if (this.options.debug) {
      console.log('FinishFlow: ❌ Validation failed, staying on current step');
    }
  }
}

prevStep() {
  // Finde den vorherigen sichtbaren Step
  let prevIndex = this.currentStep - 1;
  
  while (prevIndex >= 0) {
    const prevStep = this.steps[prevIndex];
    
    // Checke ob Step conditional ist und versteckt
    const isConditional = prevStep.hasAttribute('data-show-if') || 
                         prevStep.hasAttribute('data-hide-if');
    const isHidden = prevStep.style.display === 'none';
    
    if (isConditional && isHidden) {
      // Überspringe diesen Step
      prevIndex--;
      
      if (this.options.debug) {
        console.log('FinishFlow: Skipping conditional step backwards', prevStep.getAttribute('data-form-step'));
      }
    } else {
      // Dieser Step kann angezeigt werden
      break;
    }
  }
  
  if (prevIndex >= 0) {
    this.showStep(prevIndex);
  } else {
    // Gehe zu Step 0
    this.showStep(0);
  }
}
  preloadNextStep() {
  // Preload images/content vom nächsten Step für schnellere Transitions
  if (this.currentStep < this.steps.length - 1) {
    const nextStep = this.steps[this.currentStep + 1];
    
    // Preload images
    const images = nextStep.querySelectorAll('img');
    images.forEach(img => {
      if (!img.complete) {
        img.loading = 'eager';
        // Trigger image load
        const src = img.src;
        if (src) {
          const preloadImg = new Image();
          preloadImg.src = src;
        }
      }
    });
    
    // Preload background images
    const elementsWithBg = nextStep.querySelectorAll('[style*="background-image"]');
    elementsWithBg.forEach(el => {
      const bgUrl = el.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (bgUrl && bgUrl[1]) {
        const preloadImg = new Image();
        preloadImg.src = bgUrl[1];
      }
    });
  }
}

  
  showSubmitButton() {
    const submitBtn = this.form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.style.display = 'block';
      submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
setupAutoAdvance() {
  // Auto-advance für Div-Container mit Radio Buttons
  const autoAdvanceGroups = this.form.querySelectorAll('[data-auto-advance="true"]');
  
  if (this.options.debug) {
    console.log('FinishFlow: setupAutoAdvance - Groups found:', autoAdvanceGroups.length);
  }
  
  autoAdvanceGroups.forEach(group => {
    const radioButtons = group.querySelectorAll('input[type="radio"]');
    
    if (this.options.debug) {
      console.log('FinishFlow: Auto-advance group has radios:', radioButtons.length);
    }
    
    radioButtons.forEach(radio => {
      if (this.options.debug) {
        console.log('FinishFlow: Adding listener to radio:', radio.name, radio.value);
      }
      
      // Sofortiges visuelles Feedback
      radio.addEventListener('change', (e) => {
        if (this.options.debug) {
          console.log('FinishFlow: Radio CHANGED!', {
            name: radio.name,
            value: radio.value,
            checked: radio.checked
          });
        }
        
        // Markiere Selection visuell SOFORT
        const label = radio.closest('label') || radio.parentElement;
        if (label) {
          label.classList.add('finish-flow-selected');
        }
        
        // Capture data und advance mit minimalem Delay
        setTimeout(() => {
          if (this.options.debug) {
            console.log('FinishFlow: About to capture and advance...');
          }
          
          this.captureStepData();
          
          if (this.options.debug) {
            console.log('FinishFlow: Data captured:', this.formData);
          }
          
          this.evaluateConditionals();
          
          if (this.options.debug) {
            console.log('FinishFlow: Conditionals evaluated, calling nextStep()');
          }
          
          this.nextStep();
        }, 100);
      }, true); // useCapture = true
      
      // Hover-Effekt für besseres Feedback
      const label = radio.closest('label') || radio.parentElement;
      if (label) {
        label.addEventListener('mouseenter', () => {
          label.classList.add('finish-flow-hover');
        });
        label.addEventListener('mouseleave', () => {
          label.classList.remove('finish-flow-hover');
        });
      }
    });
  });
  
  // Auto-advance für einzelne Radio-Button-Gruppen per name
  const radioGroups = this.form.querySelectorAll('input[type="radio"][data-auto-advance]');
  const processedGroups = new Set();
  
  if (this.options.debug && radioGroups.length > 0) {
    console.log('FinishFlow: Found individual auto-advance radios:', radioGroups.length);
  }
  
  radioGroups.forEach(radio => {
    const groupName = radio.name;
    
    if (!processedGroups.has(groupName)) {
      processedGroups.add(groupName);
      
      const allRadiosInGroup = this.form.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
      
      if (this.options.debug) {
        console.log('FinishFlow: Processing individual radio group:', groupName, 'count:', allRadiosInGroup.length);
      }
      
      allRadiosInGroup.forEach(r => {
        // Sofortiges visuelles Feedback
        r.addEventListener('change', () => {
          if (this.options.debug) {
            console.log('FinishFlow: Individual radio changed:', r.name, r.value);
          }
          
          // Remove selected class from all in group
          allRadiosInGroup.forEach(otherRadio => {
            const otherLabel = otherRadio.closest('label') || otherRadio.parentElement;
            if (otherLabel) {
              otherLabel.classList.remove('finish-flow-selected');
            }
          });
          
          // Add selected class to clicked one
          const label = r.closest('label') || r.parentElement;
          if (label) {
            label.classList.add('finish-flow-selected');
          }
          
          // Advance mit minimalem Delay
          setTimeout(() => {
            this.captureStepData();
            this.evaluateConditionals();
            this.nextStep();
          }, 100);
        }, true);
        
        // Hover-Effekt
        const label = r.closest('label') || r.parentElement;
        if (label) {
          label.addEventListener('mouseenter', () => {
            label.classList.add('finish-flow-hover');
          });
          label.addEventListener('mouseleave', () => {
            label.classList.remove('finish-flow-hover');
          });
        }
      });
    }
  });
  
  // Auto-advance für Select Dropdowns
  const autoAdvanceSelects = this.form.querySelectorAll('select[data-auto-advance]');
  
  if (this.options.debug && autoAdvanceSelects.length > 0) {
    console.log('FinishFlow: Found auto-advance selects:', autoAdvanceSelects.length);
  }
  
  autoAdvanceSelects.forEach(select => {
    select.addEventListener('change', () => {
      if (this.options.debug) {
        console.log('FinishFlow: Select changed:', select.name, select.value);
      }
      
      setTimeout(() => {
        this.captureStepData();
        this.evaluateConditionals();
        this.nextStep();
      }, 150);
    });
  });
  
  if (this.options.debug) {
    console.log('FinishFlow: setupAutoAdvance completed');
  }
}


  
evaluateConditionals() {
  // Show-if Logik
  const showIfElements = this.form.querySelectorAll('[data-show-if]');
  
  if (this.options.debug) {
    console.log('FinishFlow: Evaluating conditionals - found', showIfElements.length, 'elements');
  }
  
  showIfElements.forEach(el => {
    const condition = el.getAttribute('data-show-if');
    const conditions = condition.split(',').map(c => c.trim());
    let allMatch = true;
    
    conditions.forEach(cond => {
      const [fieldName, expectedValue] = cond.split('=').map(s => s.trim());
      const actualValue = this.formData[fieldName];
      
      if (this.options.debug) {
        console.log('FinishFlow: Checking condition:', {
          condition: cond,
          fieldName,
          expectedValue,
          actualValue,
          matches: actualValue == expectedValue
        });
      }
      
      if (actualValue != expectedValue) {
        allMatch = false;
      }
    });
    
    if (allMatch) {
      el.style.display = 'block';
      // Wenn es ein Step ist, aktiviere ihn
      if (el.hasAttribute('data-form-step')) {
        el.removeAttribute('data-conditional-hidden');
        
        if (this.options.debug) {
          console.log('FinishFlow: ✅ SHOWING conditional step', el.getAttribute('data-form-step'));
        }
      }
    } else {
      el.style.display = 'none';
      if (el.hasAttribute('data-form-step')) {
        el.setAttribute('data-conditional-hidden', 'true');
        
        if (this.options.debug) {
          console.log('FinishFlow: ❌ HIDING conditional step', el.getAttribute('data-form-step'));
        }
      }
    }
  });
  
  // Hide-if Logik (umgekehrte Bedingung)
  const hideIfElements = this.form.querySelectorAll('[data-hide-if]');
  
  hideIfElements.forEach(el => {
    const condition = el.getAttribute('data-hide-if');
    const [fieldName, expectedValue] = condition.split('=').map(s => s.trim());
    const actualValue = this.formData[fieldName];
    
    if (this.options.debug) {
      console.log('FinishFlow: Checking hide-if:', {
        fieldName,
        expectedValue,
        actualValue,
        shouldHide: actualValue == expectedValue
      });
    }
    
    if (actualValue == expectedValue) {
      el.style.display = 'none';
      if (el.hasAttribute('data-form-step')) {
        el.setAttribute('data-conditional-hidden', 'true');
      }
    } else {
      el.style.display = 'block';
      if (el.hasAttribute('data-form-step')) {
        el.removeAttribute('data-conditional-hidden');
      }
    }
  });
  
  if (this.options.debug) {
    console.log('FinishFlow: Conditionals evaluation complete');
  }
}

  
  captureStepData() {
    const currentStepElement = this.steps[this.currentStep];
    const inputs = currentStepElement.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (input.name) {
        if (input.type === 'checkbox') {
          this.formData[input.name] = input.checked;
        } else if (input.type === 'radio') {
          if (input.checked) {
            this.formData[input.name] = input.value;
          }
        } else {
          this.formData[input.name] = input.value;
        }
      }
    });
    
    if (this.options.debug) {
      console.log('FinishFlow: Form data captured:', this.formData);
    }
  }
  
  saveProgress() {
    const progressData = {
      step: this.currentStep,
      data: this.formData,
      timestamp: Date.now(),
      version: '1.0.0'
    };
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(progressData));
      
      if (this.options.debug) {
        console.log('FinishFlow: Progress saved');
      }
    } catch (e) {
      console.error('FinishFlow: Could not save progress:', e);
    }
  }
  
  loadSavedProgress() {
    const saved = localStorage.getItem(this.storageKey);
    
    if (saved) {
      try {
        const { step, data, timestamp } = JSON.parse(saved);
        
        const hoursSince = (Date.now() - timestamp) / 1000 / 60 / 60;
        
        if (hoursSince < this.options.progressExpiryHours) {
          if (this.options.confirmRestore) {
            const message = 'Möchten Sie mit Ihrem gespeicherten Fortschritt fortfahren?';
            if (confirm(message)) {
              this.currentStep = step;
              this.formData = data;
              this.restoreFormFields();
              
              if (this.options.debug) {
                console.log('FinishFlow: Progress restored');
              }
            } else {
              this.clearProgress();
            }
          } else {
            // Auto-restore ohne Nachfrage
            this.currentStep = step;
            this.formData = data;
            this.restoreFormFields();
          }
        } else {
          this.clearProgress();
          
          if (this.options.debug) {
            console.log('FinishFlow: Progress expired and cleared');
          }
        }
      } catch (e) {
        console.error('FinishFlow: Could not restore progress:', e);
        this.clearProgress();
      }
    }
  }
  
  restoreFormFields() {
    Object.keys(this.formData).forEach(fieldName => {
      const fields = this.form.querySelectorAll(`[name="${fieldName}"]`);
      
      fields.forEach(field => {
        if (field.type === 'checkbox') {
          field.checked = this.formData[fieldName];
        } else if (field.type === 'radio') {
          if (field.value === this.formData[fieldName]) {
            field.checked = true;
          }
        } else {
          field.value = this.formData[fieldName];
        }
      });
    });
  }
  
  clearProgress() {
    localStorage.removeItem(this.storageKey);
    
    if (this.options.debug) {
      console.log('FinishFlow: Progress cleared');
    }
  }
  
  validateCurrentStep() {
    const currentStepElement = this.steps[this.currentStep];
    const requiredInputs = currentStepElement.querySelectorAll('[required]');
    let isValid = true;
    
    // Clear previous errors
    currentStepElement.querySelectorAll('.finish-flow-error').forEach(el => {
      el.classList.remove('finish-flow-error');
    });
    
    requiredInputs.forEach(input => {
      if (input.type === 'radio') {
        const radioGroup = currentStepElement.querySelectorAll(`input[name="${input.name}"]`);
        const isChecked = Array.from(radioGroup).some(r => r.checked);
        
        if (!isChecked) {
          radioGroup.forEach(r => {
            if (r.parentElement) {
              r.parentElement.classList.add('finish-flow-error');
            }
          });
          isValid = false;
        }
      } else if (input.type === 'checkbox') {
        if (!input.checked) {
          if (input.parentElement) {
            input.parentElement.classList.add('finish-flow-error');
          }
          isValid = false;
        }
      } else {
        if (!input.value.trim()) {
          input.classList.add('finish-flow-error');
          isValid = false;
        }
      }
    });
    
    // Show/hide error message
    const errorMsg = currentStepElement.querySelector('[data-error-message]');
    if (errorMsg) {
      if (!isValid) {
        errorMsg.style.display = 'block';
        errorMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        errorMsg.style.display = 'none';
      }
    }
    
    if (!isValid && this.options.debug) {
      console.log('FinishFlow: Validation failed on step', this.currentStep);
    }
    
    return isValid;
  }
  
updateProgressIndicators() {
  // Zähle nur sichtbare Steps
  const visibleSteps = this.steps.filter(step => {
    return step.style.display !== 'none';
  });
  
  const totalVisible = visibleSteps.length;
  const currentVisible = visibleSteps.indexOf(this.steps[this.currentStep]) + 1;
  
  // Progress bar
  const progressBar = this.form.querySelector('[data-progress-bar]');
  if (progressBar) {
    const progress = (currentVisible / totalVisible) * 100;
    progressBar.style.width = progress + '%';
  }
  
  // Step indicator text
  const stepIndicator = this.form.querySelector('[data-step-indicator]');
  if (stepIndicator) {
    stepIndicator.textContent = `Schritt ${currentVisible} von ${totalVisible}`;
  }
  
  // Step numbers/dots - update nur sichtbare
  const stepNumbers = this.form.querySelectorAll('[data-step-number]');
  let visibleIndex = 0;
  
  this.steps.forEach((step, index) => {
    if (step.style.display !== 'none') {
      if (stepNumbers[visibleIndex]) {
        stepNumbers[visibleIndex].classList.remove('active', 'completed');
        
        if (index === this.currentStep) {
          stepNumbers[visibleIndex].classList.add('active');
        } else if (index < this.currentStep) {
          stepNumbers[visibleIndex].classList.add('completed');
        }
      }
      visibleIndex++;
    }
  });
  
  // Verstecke überzählige Step Numbers
  for (let i = visibleIndex; i < stepNumbers.length; i++) {
    stepNumbers[i].style.display = 'none';
  }
}
  
  setupEventListeners() {
    // Next buttons
    const nextButtons = this.form.querySelectorAll('[data-next-button]');
    nextButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.nextStep();
      });
    });
    
    // Previous buttons
    const prevButtons = this.form.querySelectorAll('[data-prev-button]');
    prevButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.prevStep();
      });
    });
    
    // Auto-save on input changes (debounced)
    let saveTimeout;
    this.form.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.captureStepData();
        this.saveProgress();
        this.evaluateConditionals();
      }, this.options.autoSaveDelay);
    });
    
    // Keyboard navigation
    this.form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        const target = e.target;
        
        // Verhindere Enter bei Auto-Advance Elementen
        if (!target.hasAttribute('data-auto-advance') && 
            !target.closest('[data-auto-advance]')) {
          e.preventDefault();
          this.nextStep();
        }
      }
    });
    
    // Clear progress on successful submission
    this.form.addEventListener('submit', (e) => {
      if (this.options.debug) {
        console.log('FinishFlow: Form submitted');
      }
      this.clearProgress();
    });
  }
  
  // Public API methods
  goToStep(stepNumber) {
    if (stepNumber >= 0 && stepNumber < this.steps.length) {
      this.showStep(stepNumber);
    } else {
      console.error('FinishFlow: Invalid step number:', stepNumber);
    }
  }
  
  reset() {
    this.currentStep = 0;
    this.formData = {};
    this.clearProgress();
    this.form.reset();
    this.showStep(0);
    
    if (this.options.debug) {
      console.log('FinishFlow: Form reset');
    }
  }
  
  getData() {
    this.captureStepData();
    return { ...this.formData };
  }
  
  setData(data) {
    this.formData = { ...this.formData, ...data };
    this.restoreFormFields();
    this.saveProgress();
  }
}

// Make available globally
window.FinishFlow = FinishFlow;

// Auto-initialize forms with data-auto-init
document.addEventListener('DOMContentLoaded', function() {
  const autoInitForms = document.querySelectorAll('[data-finish-flow][data-auto-init]');
  
  autoInitForms.forEach(form => {
    const formId = form.id || 'form_' + Math.random().toString(36).substr(2, 9);
    form.id = formId;
    
    new FinishFlow('#' + formId);
  });
  
  console.log('FinishFlow v1.0.0 loaded');
});

