# Kubernetes Manifests

This folder contains the Kubernetes manifests for deploying the Perfume website microservices structure.

## Deployment Instructions

### 1. Build the Docker Images
Since the Kuberretes YAMLs use the `perfume-<service-name>:latest` naming convention with `imagePullPolicy: IfNotPresent`, you need to build the Docker images for all services. If you are using `minikube`, make sure to build the images inside the minikube docker daemon context.

Example command (run from the root directory):
```bash
docker build -t perfume-api-gateway:latest ./api-gateway
docker build -t perfume-user-service:latest ./user-service
docker build -t perfume-catalog-service:latest ./catalog-service
docker build -t perfume-cart-service:latest ./cart-service
docker build -t perfume-checkout-service:latest ./checkout-service
docker build -t perfume-order-service:latest ./order-service
docker build -t perfume-payment-service:latest ./payment-service
docker build -t perfume-shipping-service:latest ./shipping-service
docker build -t perfume-email-service:latest ./email-service
docker build -t perfume-recommendation-service:latest ./recommendation-service
docker build -t perfume-ad-service:latest ./ad-service
docker build -t perfume-currency-service:latest ./currency-service
docker build -t perfume-frontend:latest ./frontend
```

### 2. Apply Manifests

You can apply all matching manifests at once with `kubectl`:

```bash
kubectl apply -f ./k8s/
```
Wait for all pods to spin up successfully:
```bash
kubectl get pods --watch
```

### 3. Accessing the Application

The **frontend** service is exposed via a `NodePort` on port `30001`.
You can access it using your node IP, or in minikube with:
```bash
minikube service frontend --url
```

The database comes fully populated with empty schemas for every service corresponding to your `init-db.sql`. The microservices are linked sequentially exactly as they are configured in the original `docker-compose.yml`.
