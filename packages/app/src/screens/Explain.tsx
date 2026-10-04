import { Explain as ExplainView } from '@fm/design-system'
import { useT } from '../i18n/useT.ts'
import { EXPLAIN_TOPICS, type ExplainTopic, type ExplainTopicId } from './explain-topics.ts'

/**
 * The "i" beside a figure, opening the explanation of one topic: the design
 * system's dialog, filled from the topic's dictionary keys.
 */
export function Explain({ topic }: { readonly topic: ExplainTopicId }): React.JSX.Element {
  const translator = useT()
  const { t } = translator

  const title = t(`explain.${topic}.title`)
  // Widened to the interface deliberately: only some topics declare `params`, and
  // reading it off the const union would need a narrowing that says nothing.
  const spec: ExplainTopic = EXPLAIN_TOPICS[topic]
  // Resolved once per render rather than per paragraph — every sentence in a
  // topic draws on the same set of live values.
  const values = spec.params?.(translator)

  return (
    <ExplainView
      label={t('explain.open', { topic: title })}
      title={title}
      paragraphs={Array.from({ length: spec.paragraphs }, (_, index) =>
        t(`explain.${topic}.p${String(index + 1)}`, values),
      )}
      closeLabel={t('action.close')}
    />
  )
}
