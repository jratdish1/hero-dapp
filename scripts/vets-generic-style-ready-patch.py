#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/check-generic-error-focus.mjs')
text = path.read_text(encoding='utf-8')

old_state = """          ready: document.body?.dataset.ready || '',
          focusedId: document.activeElement?.id || '',"""
new_state = """          ready: document.body?.dataset.ready || '',
          readyError: document.body?.dataset.readyError || '',
          focusedId: document.activeElement?.id || '',"""
if text.count(old_state) != 1:
    raise SystemExit(f'expected one harness state block, found {text.count(old_state)}')
text = text.replace(old_state, new_state)

old_return = """      if (state.ready === 'true') return state;
    } catch {
      // Navigation can briefly invalidate the execution context.
    }"""
new_return = """      if (state.readyError) {
        throw new Error(`Generic focus harness readiness failed: ${state.readyError}`);
      }
      if (state.ready === 'true') return state;
    } catch (error) {
      if (
        error instanceof Error
        && error.message.startsWith('Generic focus harness readiness failed:')
      ) {
        throw error;
      }
      // Navigation can briefly invalidate the execution context.
    }"""
if text.count(old_return) != 1:
    raise SystemExit(f'expected one harness return block, found {text.count(old_return)}')
text = text.replace(old_return, new_return)

old_ready = """        if (!heading) throw new Error('Generic error heading did not mount');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        document.body.dataset.ready = 'true';
        document.body.dataset.focusedId = document.activeElement?.id || '';
        document.body.dataset.heading = heading.textContent?.trim() || '';
        document.body.dataset.focusClass = heading.className || '';
      };
      void markReady().catch(error => {
        console.error('[Generic focus harness readiness failed]', error);
      });"""
new_ready = """        if (!heading) throw new Error('Generic error heading did not mount');

        const focusStyleDeadline = Date.now() + 10_000;
        let computed = getComputedStyle(heading);
        while (Date.now() < focusStyleDeadline) {
          const outlineWidth = Number.parseFloat(computed.outlineWidth || '0');
          const visibleOutline = computed.outlineStyle !== 'none' && outlineWidth > 0;
          const visibleRing = computed.boxShadow && computed.boxShadow !== 'none';
          if (visibleOutline || visibleRing) break;
          await new Promise(resolve => requestAnimationFrame(() => resolve()));
          computed = getComputedStyle(heading);
        }
        const finalOutlineWidth = Number.parseFloat(computed.outlineWidth || '0');
        const finalVisibleOutline = computed.outlineStyle !== 'none' && finalOutlineWidth > 0;
        const finalVisibleRing = computed.boxShadow && computed.boxShadow !== 'none';
        if (!finalVisibleOutline && !finalVisibleRing) {
          throw new Error(
            'Focused heading never acquired a visible computed outline or ring; '
            + 'stylesheets=' + links.map(link => link.href).join(',')
            + '; outline=' + computed.outline
            + '; boxShadow=' + computed.boxShadow,
          );
        }

        document.body.dataset.ready = 'true';
        document.body.dataset.focusedId = document.activeElement?.id || '';
        document.body.dataset.heading = heading.textContent?.trim() || '';
        document.body.dataset.focusClass = heading.className || '';
      };
      void markReady().catch(error => {
        document.body.dataset.readyError = error instanceof Error ? error.message : String(error);
      });"""
if text.count(old_ready) != 1:
    raise SystemExit(f'expected one readiness block, found {text.count(old_ready)}')
text = text.replace(old_ready, new_ready)

path.write_text(text, encoding='utf-8')
print('generic focus computed-style readiness patch applied')
