import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, KeyRound, Sparkles } from 'lucide-react'
import { Typography } from '@mui/material'
import { WIZARD_STEPS, type WizardStepConfig } from '../activationConstants'
import ProvisionStepPanels from '../components/ProvisionStepPanels'
import { useActivationProvisioning } from '../hooks/useActivationProvisioning'

type ProvisionStudioProps = {
  token: string | null
  onGenerated: (result: { code: string; expiresAt: string }) => void
}

export default function ProvisionStudio({ token, onGenerated }: ProvisionStudioProps) {
  const p = useActivationProvisioning(token, onGenerated)
  const progress = ((p.activeStep + 1) / WIZARD_STEPS.length) * 100

  return (
    <div className="ac-studio">
      <nav className="ac-nav" aria-label="Provisioning steps">
        {WIZARD_STEPS.map((step, index) => {
          const done = index < p.activeStep
          const active = index === p.activeStep
          const Icon = step.icon
          return (
            <button
              key={step.id}
              type="button"
              className="ac-nav-item"
              data-active={active}
              data-done={done}
              onClick={() => void p.goToStep(index)}
            >
              <span className="ac-nav-index">
                {done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
              </span>
              <span>
                <div className="ac-nav-label">{step.label}</div>
                <div className="ac-nav-caption">{step.caption}</div>
              </span>
              {active && (
                <motion.span
                  layoutId="ac-nav-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: '#22d3ee',
                  }}
                />
              )}
            </button>
          )
        })}
      </nav>

      <section className="ac-stage">
        <header className="ac-stage-head">
          <Typography className="ac-stage-title" component="h2">
            {p.currentStep.label}
          </Typography>
          <Typography className="ac-stage-caption">
            {p.currentStep.caption}
          </Typography>
          <div className="ac-progress-track">
            <motion.div
              className="ac-progress-fill"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
            />
          </div>
        </header>

        <div className="ac-stage-body">
          {p.submitError && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(251,113,133,0.1)',
                border: '1px solid rgba(251,113,133,0.28)',
                color: '#fda4af',
                fontSize: 13,
              }}
            >
              {p.submitError}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={p.currentStep.id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProvisionStepPanels
                stepId={p.currentStep.id}
                form={p.form}
                documents={p.documents}
                setDocuments={p.setDocuments}
                documentsReady={p.documentsReady}
                hasMapPin={p.hasMapPin}
                mapLatitude={p.mapLatitude}
                mapLongitude={p.mapLongitude}
                mapAddress={p.mapAddress}
                serviceRadiusKm={p.serviceRadiusKm}
                setMapLatitude={p.setMapLatitude}
                setMapLongitude={p.setMapLongitude}
                setMapAddress={p.setMapAddress}
                setServiceRadiusKm={p.setServiceRadiusKm}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="ac-stage-foot">
          <button
            type="button"
            className="ac-btn ac-btn-ghost"
            disabled={p.activeStep === 0 || p.submitting}
            onClick={p.goBack}
          >
            <ChevronLeft size={15} />
            Back
          </button>

          {p.currentStep.id === 'review' ? (
            <button
              type="button"
              className="ac-btn ac-btn-primary"
              disabled={p.submitting || !token || !p.hasMapPin || !p.documentsReady}
              onClick={() => void p.submit()}
            >
              <KeyRound size={15} />
              {p.submitting ? 'Generating…' : 'Issue activation code'}
            </button>
          ) : (
            <button type="button" className="ac-btn ac-btn-primary" onClick={() => void p.goNext()}>
              Continue
              <ChevronRight size={15} />
            </button>
          )}
        </footer>
      </section>

      <InsightRail step={p.currentStep} activeStep={p.activeStep} checks={p.completionChecks} />
    </div>
  )
}

function InsightRail({
  step,
  activeStep,
  checks,
}: {
  step: WizardStepConfig
  activeStep: number
  checks: { label: string; done: boolean }[]
}) {
  const Icon = step.icon
  const doneCount = checks.filter((c) => c.done).length

  return (
    <aside className="ac-insight">
      <div>
        <div className="ac-kicker" style={{ marginBottom: 12 }}>
          Step {activeStep + 1}/{WIZARD_STEPS.length}
        </div>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            marginBottom: 12,
            background: 'rgba(45,212,191,0.12)',
            border: '1px solid rgba(45,212,191,0.28)',
            color: '#2dd4bf',
          }}
        >
          <Icon size={22} />
        </div>
        <h3 style={{ margin: 0, fontSize: 17, letterSpacing: '-0.02em' }}>{step.contextTitle}</h3>
        <p style={{ margin: '8px 0 0', color: 'var(--ac-muted)', fontSize: 13, lineHeight: 1.55 }}>
          {step.contextBody}
        </p>
      </div>

      <div className="ac-insight-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#67e8f9', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>
          <Sparkles size={13} />
          GUIDANCE
        </div>
        {step.tips.map((tip) => (
          <p key={tip} style={{ margin: '0 0 6px', color: 'var(--ac-muted)', fontSize: 12, lineHeight: 1.45 }}>
            • {tip}
          </p>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 750, letterSpacing: '0.08em', color: 'var(--ac-muted)' }}>
            READY CHECK
          </span>
          <span style={{ fontSize: 11, fontWeight: 750, color: '#2dd4bf' }}>
            {doneCount}/{checks.length}
          </span>
        </div>
        {checks.map((item) => (
          <div key={item.label} className="ac-check" data-done={item.done}>
            <Check size={13} />
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  )
}
