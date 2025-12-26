from setuptools import setup, find_packages

setup(
    name='spark-transforms',
    version='0.1.0',
    description='SPARK Foundry Transforms Package',
    packages=find_packages(),
    install_requires=[],
    entry_points={
        'transforms.pipelines': [
            'root = lib_spark.sparkpipeline',
        ],
    }
)
