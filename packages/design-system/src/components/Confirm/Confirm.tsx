import { Button } from '../Button/Button.tsx'
import { Modal } from '../Modal/Modal.tsx'
import { ScreenActions } from '../ScreenActions/ScreenActions.tsx'
import './Confirm.css'

/**
 * A question before something that cannot be taken back.
 *
 * The body says what will happen in numbers — the fee, what is left after it —
 * because "Are you sure?" teaches nothing and gets pressed through. Cancel comes
 * first and the action last, so the thumb's resting place on a phone is the safe
 * one. On a phone the dialog rises from the bottom like any other (`Modal`).
 */
export function Confirm({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  readonly title: string
  readonly children: React.ReactNode
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}): React.JSX.Element {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm__body">{children}</div>
      <ScreenActions className="confirm__actions">
        <Button type="button" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button primary type="button" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </ScreenActions>
    </Modal>
  )
}
