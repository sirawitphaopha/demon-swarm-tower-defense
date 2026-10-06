import './styles/base.css';
import './styles/menu.css';
import './styles/hud.css';
import './styles/editor.css';
import './styles/codex.css';
import { App } from './app/App';
import { installTestHook } from './app/testHook';
import { $ } from './ui/dom';
import { S } from './ui/strings';

function boot(): void {
  const canvas = $<HTMLCanvasElement>('stage');
  let app: App;
  try {
    app = new App(canvas);
  } catch (err) {
    console.error(err);
    const t = $('toast');
    t.textContent = S.webglFail;
    t.style.display = 'block';
    return;
  }
  if (app.testMode) installTestHook(app);
}

boot();
