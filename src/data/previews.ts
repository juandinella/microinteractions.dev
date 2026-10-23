import TextSwapButton from '../components/TextSwapButton.astro';
import ChevronMorphButtons from '../components/ChevronMorphButtons.astro';
import HoldToConfirmButton from '../components/HoldToConfirmButton.astro';
import EdgeAwareSlider from '../components/EdgeAwareSlider.astro';
import PluckedUnderline from '../components/PluckedUnderline.astro';
import GooeyRadioGroup from '../components/GooeyRadioGroup.astro';
import DragSelectTable from '../components/DragSelectTable.astro';
import ResizableSidebar from '../components/ResizableSidebar.astro';
import TabIndicator from '../components/TabIndicator.astro';
import WormDots from '../components/WormDots.astro';
import textSwapSource from '../components/TextSwapButton.astro?raw';
import textSwapTailwindSource from '../components/tailwind/TextSwapButton.astro?raw';
import chevronMorphSource from '../components/ChevronMorphButtons.astro?raw';
import chevronMorphTailwindSource from '../components/tailwind/ChevronMorphButtons.astro?raw';
import holdConfirmSource from '../components/HoldToConfirmButton.astro?raw';
import holdConfirmTailwindSource from '../components/tailwind/HoldToConfirmButton.astro?raw';
import edgeAwareTooltipSource from '../components/EdgeAwareSlider.astro?raw';
import edgeAwareTooltipTailwindSource from '../components/tailwind/EdgeAwareSlider.astro?raw';
import pluckedUnderlineSource from '../components/PluckedUnderline.astro?raw';
import pluckedUnderlineTailwindSource from '../components/tailwind/PluckedUnderline.astro?raw';
import gooeyRadioSource from '../components/GooeyRadioGroup.astro?raw';
import gooeyRadioTailwindSource from '../components/tailwind/GooeyRadioGroup.astro?raw';
import dragSelectSource from '../components/DragSelectTable.astro?raw';
import dragSelectTailwindSource from '../components/tailwind/DragSelectTable.astro?raw';
import resizeHandleSource from '../components/ResizableSidebar.astro?raw';
import resizeHandleTailwindSource from '../components/tailwind/ResizableSidebar.astro?raw';
import tabIndicatorSource from '../components/TabIndicator.astro?raw';
import tabIndicatorTailwindSource from '../components/tailwind/TabIndicator.astro?raw';
import wormDotsSource from '../components/WormDots.astro?raw';
import wormDotsTailwindSource from '../components/tailwind/WormDots.astro?raw';
import type { SpecimenId } from './specimens';
import type { ReducedMotion } from './source';

export type Inspection = 'timeline' | 'position' | 'none';

interface Preview {
  component: typeof TextSwapButton;
  source: string;
  tailwindSource?: string;
  filename: string;
  includeScript: boolean;
  inspection: Inspection;
  reducedMotion: ReducedMotion;
  // Attribute the demo sets while it plays. The trace then follows each element's own clock.
  activeAttribute?: string;
}

export const previews: Record<SpecimenId, Preview> = {
  'text-swap': {
    component: TextSwapButton,
    source: textSwapSource,
    tailwindSource: textSwapTailwindSource,
    filename: 'TextSwapButton.astro',
    includeScript: false,
    inspection: 'timeline',
    reducedMotion: 'component',
  },
  'chevron-morph': {
    component: ChevronMorphButtons,
    source: chevronMorphSource,
    tailwindSource: chevronMorphTailwindSource,
    filename: 'ChevronMorphButtons.astro',
    includeScript: false,
    inspection: 'timeline',
    reducedMotion: 'component',
  },
  'hold-confirm': {
    component: HoldToConfirmButton,
    source: holdConfirmSource,
    tailwindSource: holdConfirmTailwindSource,
    filename: 'HoldToConfirmButton.astro',
    includeScript: true,
    inspection: 'timeline',
    reducedMotion: 'component',
  },
  'edge-aware-tooltip': {
    component: EdgeAwareSlider,
    source: edgeAwareTooltipSource,
    tailwindSource: edgeAwareTooltipTailwindSource,
    filename: 'EdgeAwareSlider.astro',
    includeScript: true,
    inspection: 'position',
    reducedMotion: 'component',
  },
  'plucked-underline': {
    component: PluckedUnderline,
    source: pluckedUnderlineSource,
    tailwindSource: pluckedUnderlineTailwindSource,
    filename: 'PluckedUnderline.astro',
    includeScript: true,
    inspection: 'timeline',
    reducedMotion: 'component',
    activeAttribute: 'data-plucked',
  },
  'gooey-radio-group': {
    component: GooeyRadioGroup,
    source: gooeyRadioSource,
    tailwindSource: gooeyRadioTailwindSource,
    filename: 'GooeyRadioGroup.astro',
    includeScript: true,
    inspection: 'timeline',
    reducedMotion: 'component',
  },
  'drag-select': {
    component: DragSelectTable,
    source: dragSelectSource,
    tailwindSource: dragSelectTailwindSource,
    filename: 'DragSelectTable.astro',
    includeScript: true,
    inspection: 'none',
    reducedMotion: 'component',
  },
  'resize-handle': {
    component: ResizableSidebar,
    source: resizeHandleSource,
    tailwindSource: resizeHandleTailwindSource,
    filename: 'ResizableSidebar.astro',
    includeScript: true,
    inspection: 'none',
    reducedMotion: 'component',
  },
  'tab-indicator': {
    component: TabIndicator,
    source: tabIndicatorSource,
    tailwindSource: tabIndicatorTailwindSource,
    filename: 'TabIndicator.astro',
    includeScript: true,
    inspection: 'timeline',
    reducedMotion: 'component',
  },
  'worm-dots': {
    component: WormDots,
    source: wormDotsSource,
    tailwindSource: wormDotsTailwindSource,
    filename: 'WormDots.astro',
    includeScript: true,
    inspection: 'none',
    reducedMotion: 'component',
  },
};
