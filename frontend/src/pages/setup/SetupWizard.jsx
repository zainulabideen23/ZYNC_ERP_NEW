import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { onboardingAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
    Building2, Tag, Award, Ruler, Landmark, CheckCircle,
    ChevronRight, ChevronLeft
} from 'lucide-react'

import Step1Company from './steps/Step1Company'
import Step2Categories from './steps/Step2Categories'
import Step3Brands from './steps/Step3Brands'
import Step4Units from './steps/Step4Units'
import Step5OpeningBalances from './steps/Step5OpeningBalances'
import Step6Complete from './steps/Step6Complete'

const STEPS = [
    { number: 1, label: 'Company', icon: Building2 },
    { number: 2, label: 'Categories', icon: Tag },
    { number: 3, label: 'Brands', icon: Award },
    { number: 4, label: 'Units', icon: Ruler },
    { number: 5, label: 'Opening', icon: Landmark },
    { number: 6, label: 'Done', icon: CheckCircle },
]

function SetupWizard() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { tenant, updateOnboardingStep, markOnboarded } = useAuthStore()

    const initialStep = parseInt(searchParams.get('step')) || tenant?.onboarding_step || 1
    const [currentStep, setCurrentStep] = useState(Math.min(Math.max(initialStep, 1), 6))
    const [skippedSteps, setSkippedSteps] = useState(new Set())
    const [saving, setSaving] = useState(false)

    // Sync step to URL
    useEffect(() => {
        setSearchParams({ step: currentStep }, { replace: true })
    }, [currentStep, setSearchParams])

    // Block browser back while in wizard
    useEffect(() => {
        const handlePopState = (e) => {
            if (tenant?.is_onboarded === false) {
                window.history.pushState(null, '', window.location.href)
            }
        }
        window.history.pushState(null, '', window.location.href)
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [tenant?.is_onboarded])

    const goToStep = useCallback(async (step) => {
        try {
            setSaving(true)
            await onboardingAPI.updateStep(step)
            updateOnboardingStep(step)
            setCurrentStep(step)
        } catch (err) {
            toast.error('Failed to update progress')
        } finally {
            setSaving(false)
        }
    }, [updateOnboardingStep])

    const handleContinue = useCallback(async () => {
        if (currentStep < 6) {
            await goToStep(currentStep + 1)
        }
    }, [currentStep, goToStep])

    const handleBack = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
            setSearchParams({ step: currentStep - 1 }, { replace: true })
        }
    }, [currentStep, setSearchParams])

    const handleSkip = useCallback(async () => {
        setSkippedSteps(prev => new Set([...prev, currentStep]))
        await goToStep(currentStep + 1)
    }, [currentStep, goToStep])

    const handleFinish = useCallback(async () => {
        try {
            setSaving(true)
            await onboardingAPI.complete()
            markOnboarded()
            navigate('/')
        } catch (err) {
            toast.error('Failed to complete setup')
        } finally {
            setSaving(false)
        }
    }, [markOnboarded, navigate])

    const renderStep = () => {
        switch (currentStep) {
            case 1: return <Step1Company onContinue={handleContinue} saving={saving} setSaving={setSaving} />
            case 2: return <Step2Categories onContinue={handleContinue} saving={saving} />
            case 3: return <Step3Brands onContinue={handleContinue} saving={saving} />
            case 4: return <Step4Units onContinue={handleContinue} saving={saving} />
            case 5: return <Step5OpeningBalances onContinue={handleContinue} onSkip={handleSkip} saving={saving} setSaving={setSaving} />
            case 6: return <Step6Complete skippedSteps={skippedSteps} onFinish={handleFinish} />
            default: return null
        }
    }

    return (
        <div style={{
            minHeight: '100vh', background: 'var(--color-bg)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* ═══ HEADER ═══ */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 32px', borderBottom: '1px solid var(--border-surface)',
            }}>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
                    ZYNC <span style={{ color: 'var(--color-accent)', fontWeight: 400 }}>ERP</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    Step {currentStep} of {STEPS.length}
                </span>
            </div>

            {/* ═══ PROGRESS BAR ═══ */}
            <div style={{ padding: '24px 32px 0' }}>
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    maxWidth: 700, margin: '0 auto',
                }}>
                    {STEPS.map((step, idx) => {
                        const isCompleted = step.number < currentStep
                        const isCurrent = step.number === currentStep
                        const Icon = step.icon

                        return (
                            <div key={step.number} style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : 'none' }}>
                                {/* Circle + label */}
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                    position: 'relative', zIndex: 1,
                                }}>
                                    <div style={{
                                        width: isCurrent ? 42 : 36, height: isCurrent ? 42 : 36,
                                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isCompleted ? 'var(--color-accent)' : isCurrent ? 'var(--color-accent)' : 'var(--color-panel-2)',
                                        border: isCurrent ? '3px solid rgba(5, 153, 105, 0.3)' : isCompleted ? '2px solid var(--color-accent)' : '2px solid var(--border-surface)',
                                        boxShadow: isCurrent ? '0 0 20px rgba(5, 153, 105, 0.25)' : 'none',
                                        transition: 'all 0.3s ease',
                                    }}>
                                        {isCompleted ? (
                                            <CheckCircle size={18} style={{ color: '#fff' }} />
                                        ) : (
                                            <Icon size={isCurrent ? 20 : 16} style={{ color: isCurrent ? '#fff' : 'var(--color-muted)' }} />
                                        )}
                                    </div>
                                    <span style={{
                                        fontSize: '0.68rem', fontWeight: isCurrent ? 600 : 400,
                                        color: isCompleted || isCurrent ? 'var(--color-text)' : 'var(--color-hint)',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {step.label}
                                    </span>
                                </div>

                                {/* Connector line */}
                                {idx < STEPS.length - 1 && (
                                    <div style={{
                                        flex: 1, height: 2, marginBottom: 22,
                                        background: step.number < currentStep ? 'var(--color-accent)' : 'var(--color-panel-2)',
                                        transition: 'background 0.4s ease',
                                        marginLeft: 4, marginRight: 4,
                                    }} />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ═══ STEP CONTENT ═══ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px' }}>
                <div style={{
                    width: '100%', maxWidth: 720,
                    background: 'var(--color-panel)', borderRadius: 16,
                    border: '1px solid var(--border-surface)', padding: '32px 36px',
                    boxShadow: 'var(--elevation-2)',
                }}>
                    {renderStep()}
                </div>
            </div>

            {/* ═══ FOOTER ═══ */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 32px', borderTop: '1px solid var(--border-surface)',
                maxWidth: 720, width: '100%', margin: '0 auto',
            }}>
                {/* Back */}
                <div>
                    {currentStep > 1 && currentStep < 6 && (
                        <button
                            onClick={handleBack}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '10px 18px', borderRadius: 10, fontSize: '0.85rem',
                                fontWeight: 500, color: 'var(--color-muted)', cursor: 'pointer',
                                background: 'transparent', border: '1px solid var(--border-surface)',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-panel-2)'; e.currentTarget.style.color = 'var(--color-text)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-muted)' }}
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                    )}
                </div>

                {/* Skip + Continue */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {currentStep < 5 && (
                        <button
                            onClick={handleSkip}
                            disabled={saving}
                            style={{
                                padding: '10px 18px', borderRadius: 10, fontSize: '0.85rem',
                                fontWeight: 500, color: 'var(--color-hint)', cursor: saving ? 'not-allowed' : 'pointer',
                                background: 'transparent', border: 'none',
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-muted)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-hint)'}
                        >
                            Skip this step →
                        </button>
                    )}

                    {/* Continue button is inside each step component for step-specific logic */}
                </div>
            </div>
        </div>
    )
}

export default SetupWizard
