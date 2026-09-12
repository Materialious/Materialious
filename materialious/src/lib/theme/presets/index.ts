import { catppuccinPresets } from './catppuccin';
import { draculaPresets } from './dracula';
import { everforestPresets } from './everforest';
import { gruvboxPresets } from './gruvbox';
import { nordPresets } from './nord';
import { rosepinePresets } from './rosepine';
import { solarizedPresets } from './solarized';
import { tokyoNightPresets } from './tokyo-night';

export { buildTheme, type MaterialSeed, type Preset } from './shared';

export const presets = [
	...catppuccinPresets,
	...rosepinePresets,
	...tokyoNightPresets,
	...nordPresets,
	...draculaPresets,
	...gruvboxPresets,
	...solarizedPresets,
	...everforestPresets
];
