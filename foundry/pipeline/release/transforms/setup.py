from setuptools import setup, find_packages

setup(
    name='sitrep-transforms',
    version='0.0.1',
    description='SITREP transforms',
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    install_requires=[],
)
