import type { AnswerBlock, BrowserAction } from './actions';

export type { ActionType, AnswerBlock, BrowserAction } from './actions';

export type AgentStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'waiting_for_approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskTurn {
  /** What the user typed for this follow-up. */
  text: string;
  at: number;
}

export interface AgentTask {
  id: string;
  objective: string;
  /** Follow-up messages in this conversation, oldest first. */
  turns?: TaskTurn[];
  /** Extra instructions for the model that are not part of the displayed objective. */
  context?: string;
  status: AgentStatus;
  currentStep: number;
  maxSteps: number;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'compatible';

export interface ProviderConfig {
  id: string;
  provider: ProviderId;
  label?: string;
  model: string;
  baseUrl?: string;
  visionOverride?: boolean;
}

export interface Credentials {
  apiKey: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd?: number;
}

export interface PageViewport {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  scrollHeight: number;
}

export interface InteractiveElement {
  id: string;
  tag: string;
  role?: string;
  type?: string;
  text?: string;
  accessibleName?: string;
  placeholder?: string;
  value?: string;
  href?: string;
  disabled: boolean;
  visible: boolean;
  inForm: boolean;
  inViewport?: boolean;
  checked?: boolean;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface PageSnapshot {
  url: string;
  title: string;
  viewport: PageViewport;
  elements: InteractiveElement[];
  textContent: string;
  /** Compact hierarchical accessibility tree with element ids for controls. */
  a11yText?: string;
  /** Text from the active dialog/panel/portal, which may sit outside body copy. */
  overlayText?: string;
  /** Page-level conditions the model must not miss (stock, CAPTCHA, sign-in). */
  signals?: string[];
  /** Enabled actionable labels, most relevant first. */
  primaryActions?: string[];
  disabledActions?: string[];
  capturedAt: number;
}

export type StepStatus = 'success' | 'failed' | 'rejected';

export interface AgentStep {
  id: string;
  index: number;
  action: BrowserAction;
  label: string;
  status: StepStatus;
  result: string;
  observation: string;
  reasoning?: string;
  providerReasoning?: string;
  image?: string;
  at: number;
}

export interface Settings {
  theme: 'dark' | 'light';
  activeProviderId?: string;
  maxSteps: number;
  maxCostUsd: number;
  approvalMode: 'sensitive' | 'all';
  sessionOnlyKeys: boolean;
}

export interface TaskRecord {
  id: string;
  objective: string;
  status: AgentStatus;
  summary?: string;
  blocks?: AnswerBlock[];
  turns?: TaskTurn[];
  stepCount: number;
  createdAt: number;
  completedAt?: number;
  costUsd: number;
  tokens?: number;
  steps?: AgentStep[];
  provider?: string;
  model?: string;
}

export type ApprovalKind = 'sensitive' | 'scope';

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  title: string;
  detail: string;
  actionLabel?: string;
  origin?: string;
  stepIndex?: number;
}

export interface TaskCheckpoint {
  task: AgentTask;
  steps: AgentStep[];
  usage: Usage;
  providerConfigId?: string;
  tabId?: number;
  savedAt: number;
}

export interface RunContextTab {
  id: number;
  url?: string;
  title?: string;
}
