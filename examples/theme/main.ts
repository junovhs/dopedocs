import { mountPanel } from 'dopedocs/panel';
import { docs } from './docs';
const panel = mountPanel(document.body, docs);
document.querySelector('#read')!.addEventListener('click', () => panel.open());
