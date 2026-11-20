import type { BrowserAction, InteractiveElement, Settings } from '@/types';

const SENSITIVE_TEXT =
  /\b(submit|send|apply(?! filter)|post|publish|pay|purchase|buy|checkout|place order|confirm order|transfer|delete|remove|unsubscribe|cancel subscription|sign up|register|book|reserve|donate)\b/i;

export interface RiskAssessment {
  requiresApproval: boolean;
  reason: string;
  actionLabel: string;
}

function labelFor(element?: InteractiveElement | null): string {
  if (!element) return '';
  return element.accessibleName || element.text || element.placeholder || element.id;
}

function isSensitiveElement(element: InteractiveElement | null | undefined): boolean {
  if (!element) return false;
  const label = `${element.accessibleName ?? ''} ${element.text ?? ''} ${element.value ?? ''}`.trim();
  if (element.type === 'submit') return true;
  if (element.tag === 'input' && (element.type === 'submit' || element.type === 'button') && SENSITIVE_TEXT.test(label)) {
    return true;
  }
  if ((element.tag === 'button' || element.role === 'button' || element.role === 'menuitem') && SENSITIVE_TEXT.test(label)) {
    return true;
  }
  if (element.tag === 'a' && SENSITIVE_TEXT.test(label)) return true;
  return false;
}

export interface AssessInput {
  action: BrowserAction;
  target?: InteractiveElement | null;
  coordinatesTarget?: Pick<InteractiveElement, 'tag' | 'type' | 'inForm'> & { accessibleName?: string; text?: string } | null;
  focusedElement?: { inForm: boolean } | null;
  mode: Settings['approvalMode'];
}

export function assessAction(input: AssessInput): RiskAssessment | null {
  const { action, target, coordinatesTarget, focusedElement, mode } = input;
  if (action.type === 'finish') return null;

  const interactive =
    action.type === 'navigate' ||
    action.type === 'click' ||
    action.type === 'click_at' ||
    action.type === 'type' ||
    action.type === 'press_key';

  if (mode === 'all' && interactive) {
    const label =
      action.type === 'navigate'
        ? action.url
        : action.type === 'click'
          ? labelFor(target)
          : action.type === 'type'
            ? `type into ${labelFor(target)}`
            : action.type;
    return { requiresApproval: true, reason: 'Approval mode requires confirmation for every browser action.', actionLabel: label };
  }

  if (action.type === 'click' && isSensitiveElement(target ?? null)) {
    return {
      requiresApproval: true,
      reason: 'This control submits, sends, purchases, deletes or otherwise changes something on your behalf.',
      actionLabel: labelFor(target),
    };
  }

  if (action.type === 'click_at' && coordinatesTarget) {
    const pseudo: InteractiveElement = {
      id: 'coordinate-target',
      tag: coordinatesTarget.tag,
      type: coordinatesTarget.type,
      text: coordinatesTarget.text,
      accessibleName: coordinatesTarget.accessibleName,
      disabled: false,
      visible: true,
      inForm: coordinatesTarget.inForm,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    };
    if (isSensitiveElement(pseudo)) {
      return {
        requiresApproval: true,
        reason: 'The element at those coordinates looks like a submit, send or purchase control.',
        actionLabel: labelFor(pseudo),
      };
    }
  }

  if (action.type === 'press_key' && action.key === 'Enter' && focusedElement?.inForm) {
    return {
      requiresApproval: true,
      reason: 'Pressing Enter inside a form can submit it.',
      actionLabel: 'Press Enter in a form',
    };
  }

  return null;
}
