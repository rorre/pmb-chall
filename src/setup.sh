#!/bin/sh
pushd backend
    docker build -t pmbackend .
popd
