"""Check local Markdown links in this task's owning docs/receipt; historical baseline snapshots excluded."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote

root = Path(__file__).resolve().parents[5]
paths = [
    root / 'docs/user/library/TRACKER.md',
    root / 'docs/user/library/SDD-06-after-book-entry-ui.md',
    root / 'docs/user/library/INTERACTION-MAP.md',
    root / 'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/TRACKER.md',
    root / 'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md',
]
paths += list(Path(__file__).parent.glob('*.md'))
errors = []
for path in paths:
    text = path.read_text(encoding='utf-8-sig')
    for link in re.findall(r'\]\(([^)]+)\)', text):
        target = link.split('#')[0].strip('<>')
        if not target or re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target):
            continue
        # Codex file links may include a one-based source line suffix.
        target = re.sub(r':\d+$', '', target)
        if not (path.parent / unquote(target)).exists():
            errors.append(f'{path.relative_to(root)} -> {target}')
print(f'LOCAL_LINK_FILES={len(paths)}')
print('\n'.join(errors) if errors else 'LOCAL_LINK_CHECK=PASS')
sys.exit(bool(errors))
