/**
 * Finish Flow v3.2.0 - Smart Multi-Step Form System for Webflow
 * NEW v3.2: finish_track Integration (Steps, A/B Tests, Meta CAPI)
 * NEW v3.1: URL Step Tracking, Custom Button IDs
 * NEW v3.0: A/B Testing Support
 * Backwards Compatible with v2.0
 * Author: Finish Media
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
      updateURL: true,
      abSplit: [50, 50],
      
      // NEW v3.2: finish_track Integration
      tracking: {
        enabled: true,
        funnelId: null, // Auto-detect from form.id if null
        trackSteps: true,
        trackABTest: true,
        trackAutoAdvance: true,
        trackBackButton: true,
        trackFormSubmit: true,
      },
      
      ...options
    };
    
    // Auto-detect funnel ID from form.id if not provided
    if (this.config.tracking.enabled && !this.config.tracking.funnelId) {
      this.config.tracking.funnelId = this.form.id || 'finish_flow_form';
    }
    
    this.state = {
      currentStep: 0,
      formData: {},
      initialized: false,
      startTime: Date.now()
    };
    
    this.abTest = {
      enabled: false,
      testName: null,
      variant: null,
      variants: []
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
    
    this.initABTest();
    this.updateVisibility();
    
    const restored = this.loadProgress();
    if (!restored) {
      this.state.currentStep = 0;
    }
    
    this.setupEventListeners();
    this.setupAutoAdvance();
    this.render();
    this.updateURL();
    
    // Track initial step
    this.trackStep();
    
    this.state.initialized = true;
    
    if (this.config.debug) {
      console.log('✅ FinishFlow v3.2 initialized', {
        abTest: this.abTest.enabled ? `${this.abTest.testName} (${this.abTest.variant})` : 'disabled',
        tracking: this.config.tracking.enabled ? this.config.tracking.funnelId : 'disabled'
      });
    }
  }
  
  // ============================================
  // A/B TESTING MODULE
  // ============================================
  
  initABTest() {
    const testName = this.form.getAttribute('data-ab-test');
    
    if (!testName) {
      return;
    }
    
    this.abTest.enabled = true;
    this.abTest.testName = testName;
    
    this.detectVariants();
    
    if (this.abTest.variants.length === 0) {
      console.warn('⚠️ A/B Test enabled but no variants found. Add data-variant attributes.');
      this.abTest.enabled = false;
      return;
    }
    
    const urlVariant = this.getURLVariant();
    
    if (urlVariant && this.abTest.variants.includes(urlVariant)) {
      this.abTest.variant = urlVariant;
      this.saveVariant();
      
      if (this.config.debug) {
        console.log('🔗 A/B Test: URL forced variant:', urlVariant);
      }
    } else {
      this.abTest.variant = this.loadVariant();
      
      if (!this.abTest.variant || !this.abTest.variants.includes(this.abTest.variant)) {
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
    
    this.applyVariant();
    
    this.form.setAttribute('data-ab-variant', this.abTest.variant);
    document.body.setAttribute('data-ab-variant', this.abTest.variant);
    
    // NEW v3.2: Track A/B Test Assignment
    if (this.config.tracking.enabled && this.config.tracking.trackABTest) {
      this.trackABTest();
    }
  }
  
  detectVariants() {
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
    const variants = this.abTest.variants;
    const splits = this.config.abSplit;
    
    let normalizedSplits = splits;
    const sum = splits.reduce((a, b) => a + b, 0);
    
    if (sum !== 100) {
      normalizedSplits = splits.map(s => (s / sum) * 100);
    }
    
    while (normalizedSplits.length < variants.length) {
      normalizedSplits.push(100 / variants.length);
    }
    
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < variants.length; i++) {
      cumulative += normalizedSplits[i];
      if (random < cumulative) {
        return variants[i];
      }
    }
    
    return variants[0];
  }
  
  saveVariant() {
    if (!this.abTest.enabled) return;
    
    const key = `ab_${this.abTest.testName}`;
    const value = this.abTest.variant;
    
    try {
      document.cookie = `${key}=${value}; max-age=${30*24*60*60}; path=/; SameSite=Lax`;
    } catch (e) {
      console.warn('⚠️ Could not set cookie:', e);
    }
    
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('⚠️ Could not set localStorage:', e);
    }
  }
  
  loadVariant() {
    if (!this.abTest.enabled) return null;
    
    const key = `ab_${this.abTest.testName}`;
    
    try {
      const cookies = document.cookie.split('; ');
      const cookie = cookies.find(row => row.startsWith(key + '='));
      
      if (cookie) {
        return cookie.split('=')[1];
      }
    } catch (e) {
      console.warn('⚠️ Could not read cookie:', e);
    }
    
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('⚠️ Could not read localStorage:', e);
    }
    
    return null;
  }
  
  applyVariant() {
    if (!this.abTest.enabled) return;
    
    const variantElements = this.form.querySelectorAll('[data-variant]');
    
    variantElements.forEach(el => {
      const elVariant = el.getAttribute('data-variant').toUpperCase();
      
      if (elVariant !== this.abTest.variant) {
        el.style.display = 'none';
        el.setAttribute('data-ab-hidden', 'true');
        
        if (el.hasAttribute('data-form-step')) {
          el.setAttribute('data-conditional-hidden', 'true');
        }
      } else {
        el.removeAttribute('data-ab-hidden');
      }
    });
  }
  
  // ============================================
  // URL STEP TRACKING
  // ============================================
  
  updateURL() {
    if (!this.config.updateURL) return;
    
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    if (!currentStepElement) return;
    
    const stepId = currentStepElement.getAttribute('data-step-id') 
                || currentStepElement.getAttribute('data-form-step');
    
    if (!stepId) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('step', stepId);
    
    const newUrl = window.location.pathname + '?' + urlParams.toString();
    
    window.history.replaceState(
      { step: stepId }, 
      '', 
      newUrl
    );
    
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
  // FINISH_TRACK INTEGRATION (NEW v3.2)
  // ============================================
  
  trackStep() {
    if (!this.config.tracking.enabled || !this.config.tracking.trackSteps) return;
    if (typeof FinishTrack === 'undefined') return;
    
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    if (!currentStepElement) return;
    
    const stepId = currentStepElement.getAttribute('data-step-id') 
                || currentStepElement.getAttribute('data-form-step');
    
    FinishTrack.step(
      this.config.tracking.funnelId,
      this.state.currentStep + 1,
      stepId,
      this.visibleSteps.length
    );
    
    if (this.config.debug) {
      console.log('📊 finish_track: step_viewed', {
        funnel: this.config.tracking.funnelId,
        step: this.state.currentStep + 1,
        stepId: stepId
      });
    }
  
  }
  
  trackABTest() {
    if (!this.abTest.enabled) return;
    if (typeof FinishTrack === 'undefined') return;
    
    FinishTrack.experiment(
      this.abTest.testName,
      this.abTest.variant
    );
    
    if (this.config.debug) {
      console.log('📊 finish_track: experiment_viewed', {
        test: this.abTest.testName,
        variant: this.abTest.variant
      });
    }
  }
  
  trackAutoAdvance(inputType, fieldName, fieldValue) {
    if (!this.config.tracking.enabled || !this.config.tracking.trackAutoAdvance) return;
    if (typeof FinishTrack === 'undefined') return;
    
    const currentStepElement = this.visibleSteps[this.state.currentStep];
    const stepId = currentStepElement?.getAttribute('data-step-id') 
                || currentStepElement?.getAttribute('data-form-step');
    
    FinishTrack.track('auto_advance_triggered', {
      input_type: inputType,
      field_name: fieldName,
      field_value: fieldValue,
      step_id: stepId,
      funnel_id: this.config.tracking.funnelId
    });
    
    if (this.config.debug) {
      console.log('📊 finish_track: auto_advance_triggered', {
        type: inputType,
        field: fieldName,
        value: fieldValue
      });
    }
  }
  
  trackBackButton(fromStep, toStep) {
    if (!this.config.tracking.enabled || !this.config.tracking.trackBackButton) return;
    if (typeof FinishTrack === 'undefined') return;
    
    FinishTrack.track('step_back_clicked', {
      from_step: fromStep,
      to_step: toStep,
      funnel_id: this.config.tracking.funnelId
    });
    
    if (this.config.debug) {
      console.log('📊 finish_track: step_back_clicked', {
        from: fromStep,
        to: toStep
      });
    }
  }
  
  trackFormSubmit() {
    if (!this.config.tracking.enabled || !this.config.tracking.trackFormSubmit) return;
    if (typeof FinishTrack === 'undefined') return;
    
    const completionTime = Date.now() - this.state.startTime;
    
    FinishTrack.track('form_submitted', {
      form_id: this.form.id,
      funnel_id: this.config.tracking.funnelId,
      total_steps: this.visibleSteps.length,
      completion_time_seconds: Math.round(completionTime / 1000),
      ab_variant: this.abTest.variant || null
    });
    
    if (this.config.debug) {
      console.log('📊 finish_track: form_submitted', {
        form: this.form.id,
        time: Math.round(completionTime / 1000) + 's',
        variant: this.abTest.variant
      });
    }
  }
  

    // finish_track CAPI
    if (typeof FinishTrack !== 'undefined' && typeof FinishTrack.trackMetaEvent === 'function') {
      await FinishTrack.trackMetaEvent(this.config.tracking.metaCAPI.eventType, {
        eventID: eventID,
        email: emailField.value
      });
      
      if (this.config.debug) {
        console.log('📊 finish_track CAPI: Lead Event', eventID);
      }
    }
  }
  
  // ============================================
  // CORE FUNCTIONS
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
      this.updateURL();
      this.trackStep();
      this.saveProgress();
    } else {
      this.showSubmitButton();
    }
  }
  
  prevStep() {
    if (this.state.currentStep > 0) {
      const fromStepElement = this.visibleSteps[this.state.currentStep];
      const fromStep = fromStepElement.getAttribute('data-step-id') 
                    || fromStepElement.getAttribute('data-form-step');
      
      this.state.currentStep--;
      
      const toStepElement = this.visibleSteps[this.state.currentStep];
      const toStep = toStepElement.getAttribute('data-step-id') 
                  || toStepElement.getAttribute('data-form-step');
      
      this.trackBackButton(fromStep, toStep);
      
      this.render();
      this.updateURL();
      this.trackStep();
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
    const finishFlowInstance = this;
    
    const autoAdvanceSteps = this.form.querySelectorAll('[data-form-step][data-auto-advance="true"]');
    
    autoAdvanceSteps.forEach(step => {
      const radios = step.querySelectorAll('input[type="radio"]');
      
      radios.forEach(radio => {
        let wasChecked = false;
        
        radio.addEventListener('mousedown', function() {
          wasChecked = this.checked;
        });
        
        radio.addEventListener('click', function() {
          const allRadiosInGroup = finishFlowInstance.form.querySelectorAll(`input[name="${this.name}"]`);
          allRadiosInGroup.forEach(r => {
            const label = finishFlowInstance.findLabelForInput(r);
            if (label) label.classList.remove('finish-flow-selected');
          });
          
          const currentLabel = finishFlowInstance.findLabelForInput(this);
          if (currentLabel) currentLabel.classList.add('finish-flow-selected');
          
          setTimeout(() => {
            finishFlowInstance.captureStepData();
            
            // NEW v3.2: Track Auto-Advance
            finishFlowInstance.trackAutoAdvance('radio', this.name, this.value);
            
            finishFlowInstance.nextStep();
          }, finishFlowInstance.config.autoAdvanceDelay);
        });
      });
      
      const selects = step.querySelectorAll('select');
      
      selects.forEach(select => {
        select.addEventListener('change', function() {
          setTimeout(() => {
            finishFlowInstance.captureStepData();
            
            // NEW v3.2: Track Auto-Advance
            finishFlowInstance.trackAutoAdvance('select', this.name, this.value);
            
            finishFlowInstance.nextStep();
          }, finishFlowInstance.config.autoAdvanceDelay);
        });
      });
    });
  }
  
  findLabelForInput(input) {
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel;
    
    if (input.id) {
      const linkedLabel = this.form.querySelector(`label[for="${input.id}"]`);
      if (linkedLabel) return linkedLabel;
    }
    
    const nextLabel = input.nextElementSibling;
    if (nextLabel && nextLabel.tagName === 'LABEL') return nextLabel;
    
    const parent = input.parentElement;
    if (parent && parent.classList.contains('w-radio')) return parent;
    
    return parent;
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
      version: '3.2.0',
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
      
      if (version && !['2.0.0', '3.0.0', '3.1.0', '3.2.0'].includes(version)) {
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
      
      if (this.abTest.enabled && abVariant && abVariant !== this.abTest.variant) {
        if (this.config.debug) {
          console.log('⚠️ A/B variant changed, clearing progress');
        }
        this.clearProgress();
        return false;
      }
      
      this.state.formData = data;
      this.restoreFormFields();
      
      this.updateVisibility();
      
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
    
    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = progress + '%';
    }
    
    const allCustomProgressBars = document.querySelectorAll('[data-progress-bar-finish]');
    
    if (allCustomProgressBars.length > 0) {
      allCustomProgressBars.forEach(bar => {
        bar.style.width = progress + '%';
        bar.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    }
    
    if (this.elements.stepIndicator) {
      this.elements.stepIndicator.textContent = `Schritt ${currentStepNumber} von ${totalSteps}`;
    }
    
    const allStepIndicators = document.querySelectorAll('[data-step-indicator]');
    if (allStepIndicators.length > 0) {
      allStepIndicators.forEach(indicator => {
        indicator.textContent = `Schritt ${currentStepNumber} von ${totalSteps}`;
      });
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
    
    // NEW v3.2: Track Form Submit
    this.trackFormSubmit();
    
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
      this.updateURL();
      this.trackStep();
      this.saveProgress();
    } else {
      console.error('❌ Invalid step number:', stepNumber);
    }
  }
  
  reset() {
    this.state.currentStep = 0;
    this.state.formData = {};
    this.state.startTime = Date.now();
    this.clearProgress();
    this.form.reset();
    this.updateVisibility();
    this.render();
    this.updateURL();
    this.trackStep();
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
    
    this.abTest.variant = upperVariant;
    this.saveVariant();
    
    this.applyVariant();
    this.updateVisibility();
    
    this.state.currentStep = 0;
    this.clearProgress();
    this.render();
    
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
    
    this.abTest.variant = this.assignVariant();
    this.saveVariant();
    
    this.applyVariant();
    this.updateVisibility();
    this.state.currentStep = 0;
    this.clearProgress();
    this.render();
    
    this.form.setAttribute('data-ab-variant', this.abTest.variant);
    document.body.setAttribute('data-ab-variant', this.abTest.variant);
    
    if (this.config.debug) {
      console.log('🎲 Variant reset to:', this.abTest.variant);
    }
    
    return this.abTest.variant;
  }
}

// ============================================
// GLOBAL HELPER FUNCTIONS
// ============================================

window.FinishFlow = FinishFlow;

window.FinishFlow.getVariant = function(testName) {
  const key = `ab_${testName}`;
  
  const cookies = document.cookie.split('; ');
  const cookie = cookies.find(row => row.startsWith(key + '='));
  if (cookie) {
    return cookie.split('=')[1];
  }
  
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

window.FinishFlow.setVariant = function(testName, variant) {
  const key = `ab_${testName}`;
  const value = variant.toUpperCase();
  
  try {
    document.cookie = `${key}=${value}; max-age=${30*24*60*60}; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn('⚠️ Could not set cookie:', e);
  }
  
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('⚠️ Could not set localStorage:', e);
  }
  
  console.log(`✅ Variant set: ${testName} = ${value} (reload page to apply)`);
};

window.FinishFlow.resetVariant = function(testName) {
  const key = `ab_${testName}`;
  
  try {
    document.cookie = `${key}=; max-age=0; path=/`;
  } catch (e) {
    console.warn('⚠️ Could not delete cookie:', e);
  }
  
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
  
  console.log('✅ Finish Flow v3.2.0');
});
