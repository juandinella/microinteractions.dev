import type { ShikiConfig } from 'astro';

// Colors resolve to --code-* custom properties, defined where the code frame is styled.
const role = (name: string) => `var(--code-${name})`;

export const codeTheme: ShikiConfig['theme'] = {
  name: 'specimen-ink',
  type: 'dark',
  fg: role('text'),
  bg: role('bg'),
  settings: [
    { settings: { foreground: role('text'), background: role('bg') } },
    {
      scope: ['comment', 'punctuation.definition.comment', 'punctuation', 'keyword.operator', 'meta.brace'],
      settings: { foreground: role('muted') },
    },
    {
      scope: [
        'keyword', 'storage', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.gradient',
        'keyword.operator.logical.and.media', 'keyword.operator.logical.feature', 'keyword.operator.logical.not.media',
        'punctuation.definition.keyword', 'entity.other.attribute-name.pseudo-class', 'entity.other.attribute-name.pseudo-element',
      ],
      settings: { foreground: role('keyword') },
    },
    {
      scope: [
        'entity.name.tag', 'support.class.component', 'entity.other.attribute-name.class.css', 'punctuation.definition.entity.css',
        'entity.name.type', 'support.type.primitive', 'support.type.builtin', 'support.class',
      ],
      settings: { foreground: role('tag') },
    },
    {
      scope: [
        'entity.other.attribute-name', 'support.type.property-name', 'support.type.vendored.property-name',
        'variable.css', 'variable.argument.css', 'meta.object-literal.key',
      ],
      settings: { foreground: role('attribute') },
    },
    {
      scope: ['string', 'punctuation.definition.string', 'string.regexp'],
      settings: { foreground: role('string') },
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: role('function') },
    },
    {
      scope: [
        'constant.numeric', 'constant.language', 'constant.character', 'constant.other.color', 'support.constant',
        'keyword.other.unit', 'punctuation.definition.constant',
      ],
      settings: { foreground: role('number') },
    },
  ],
};
