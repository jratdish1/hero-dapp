from pathlib import Path

BASE = Path('/tmp/pnpm-lock.base.yaml')
TARGET = Path('pnpm-lock.yaml')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


text = BASE.read_text(encoding='utf-8')

text = replace_once(
    text,
    """      autoprefixer:
        specifier: ^10.4.20
        version: 10.4.21(postcss@8.5.15)
""",
    """      autoprefixer:
        specifier: ^10.4.20
        version: 10.4.21(postcss@8.5.23)
""",
    'autoprefixer importer',
)
text = replace_once(
    text,
    """      postcss:
        specifier: ^8.5.15
        version: 8.5.15
""",
    """      postcss:
        specifier: ^8.5.23
        version: 8.5.23
""",
    'postcss importer',
)
text = replace_once(
    text,
    """  nanoid@3.3.12:
    resolution: {integrity: sha512-ZB9RH/39qpq5Vu6Y+NmUaFhQR6pp+M2Xt76XBnEwDaGcVAqhlvxrl3B2bKS5D3NH3QR76v3aSrKaF/Kiy7lEtQ==}
    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
    hasBin: true

""",
    """  nanoid@3.3.12:
    resolution: {integrity: sha512-ZB9RH/39qpq5Vu6Y+NmUaFhQR6pp+M2Xt76XBnEwDaGcVAqhlvxrl3B2bKS5D3NH3QR76v3aSrKaF/Kiy7lEtQ==}
    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
    hasBin: true

  nanoid@3.3.17:
    resolution: {integrity: sha512-xQLf0A3HOMlgHq0n247/LRuAOYmB7dXJ/DvAxGvsSBij45XtBSmQycu+F8ODbHwns/XyFZagyL1+J0Offw1E0g==}
    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
    hasBin: true

""",
    'nanoid package inventory',
)
text = replace_once(
    text,
    """  postcss@8.5.15:
    resolution: {integrity: sha512-FfR8sjd4em2T6fb3I2MwAJU7HWVMr9zba+enmQeeWFfCbm+UOC/0X4DS8XtpUTMwWMGbjKYP7xjfNekzyGmB3A==}
    engines: {node: ^10 || ^12 || >=14}
""",
    """  postcss@8.5.23:
    resolution: {integrity: sha512-g50586zr4bZmwFiTlflMu8E0bDTb5I5gertgwAKmsdUlTQIhZtunzUlD1WSzwcVWPoAVpsrA6vlfCD7oXvRwgg==}
    engines: {node: ^10 || ^12 || >=14}
""",
    'postcss package',
)
text = replace_once(
    text,
    """  autoprefixer@10.4.21(postcss@8.5.15):
    dependencies:
      browserslist: 4.26.3
      caniuse-lite: 1.0.30001748
      fraction.js: 4.3.7
      normalize-range: 0.1.2
      picocolors: 1.1.1
      postcss: 8.5.15
      postcss-value-parser: 4.2.0
""",
    """  autoprefixer@10.4.21(postcss@8.5.23):
    dependencies:
      browserslist: 4.26.3
      caniuse-lite: 1.0.30001748
      fraction.js: 4.3.7
      normalize-range: 0.1.2
      picocolors: 1.1.1
      postcss: 8.5.23
      postcss-value-parser: 4.2.0
""",
    'autoprefixer snapshot',
)
text = replace_once(
    text,
    """  nanoid@3.3.12: {}

""",
    """  nanoid@3.3.12: {}

  nanoid@3.3.17: {}

""",
    'nanoid snapshot inventory',
)
text = replace_once(
    text,
    """  postcss@8.5.15:
    dependencies:
      nanoid: 3.3.12
      picocolors: 1.1.1
      source-map-js: 1.2.1
""",
    """  postcss@8.5.23:
    dependencies:
      nanoid: 3.3.17
      picocolors: 1.1.1
      source-map-js: 1.2.1
""",
    'postcss snapshot',
)
text = replace_once(
    text,
    """      postcss: 8.5.15
      rollup: 4.60.4
""",
    """      postcss: 8.5.23
      rollup: 4.60.4
""",
    'vite postcss snapshot',
)

TARGET.write_text(text, encoding='utf-8')
