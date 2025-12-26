from transforms.api import Pipeline
from sparkproject.datasets import spark_transforms

my_pipeline = Pipeline()
my_pipeline.discover_transforms(spark_transforms)
