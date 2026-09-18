.PHONY: test run load image kind-up deploy-local clean-local

test:
	npm test

run:
	npm start

load:
	npm run load

image:
	docker build -t reliability-api:local .

kind-up:
	kind create cluster --name reliability-lab

deploy-local: image
	kind load docker-image reliability-api:local --name reliability-lab
	kubectl apply -k k8s/base
	kubectl set image deployment/reliability-api api=reliability-api:local -n reliability-lab
	kubectl rollout status deployment/reliability-api -n reliability-lab --timeout=120s

clean-local:
	kind delete cluster --name reliability-lab
