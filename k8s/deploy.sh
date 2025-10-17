#!/bin/bash

# Bore Kubernetes Deployment Script
# Deploys Bore to Kubernetes with environment-specific configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEFAULT_ENVIRONMENT="development"
DEFAULT_NAMESPACE="bore-system"

# Functions
print_header() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}"
}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl > /dev/null 2>&1; then
        print_error "kubectl is required"
        exit 1
    fi

    # Check kustomize
    if ! command -v kustomize > /dev/null 2>&1; then
        print_error "kustomize is required"
        exit 1
    fi

    # Check cluster access
    if ! kubectl cluster-info > /dev/null 2>&1; then
        print_error "Cannot access Kubernetes cluster"
        exit 1
    fi

    # Check if namespace exists (optional, will be created if not)
    local namespace=${NAMESPACE:-$DEFAULT_NAMESPACE}
    if kubectl get namespace "$namespace" > /dev/null 2>&1; then
        print_status "Namespace '$namespace' exists"
    else
        print_warning "Namespace '$namespace' will be created"
    fi

    print_status "Prerequisites check completed"
}

# Build and push Docker images
build_and_push_images() {
    local environment=${1:-$DEFAULT_ENVIRONMENT}

    if [ "$SKIP_BUILD" = "true" ]; then
        print_status "Skipping image build (SKIP_BUILD=true)"
        return
    fi

    print_header "Building Docker Images"

    local registry=${DOCKER_REGISTRY:-"localhost:5000"}
    local version=${VERSION:-"latest"}

    print_status "Building images for environment: $environment"
    print_status "Registry: $registry"
    print_status "Version: $version"

    # Build backend image
    print_status "Building backend image..."
    cd "$PROJECT_ROOT/backend"

    local backend_tag="$registry/bore/backend:$version"
    docker build -t "$backend_tag" .

    if [ "$PUSH_IMAGES" = "true" ]; then
        print_status "Pushing backend image..."
        docker push "$backend_tag"
    fi

    # Build server image
    print_status "Building server image..."
    cd "$PROJECT_ROOT"

    local server_tag="$registry/bore/server:$version"
    docker build -f bore-server/Dockerfile -t "$server_tag" .

    if [ "$PUSH_IMAGES" = "true" ]; then
        print_status "Pushing server image..."
        docker push "$server_tag"
    fi

    print_status "Docker images built successfully"
}

# Deploy to Kubernetes
deploy_to_k8s() {
    local environment=${1:-$DEFAULT_ENVIRONMENT}

    print_header "Deploying to Kubernetes"

    local namespace=${NAMESPACE:-$DEFAULT_NAMESPACE}
    local overlay_dir="$SCRIPT_DIR/overlays/$environment"

    if [ ! -d "$overlay_dir" ]; then
        print_error "Environment overlay not found: $overlay_dir"
        exit 1
    fi

    print_status "Using environment: $environment"
    print_status "Namespace: $namespace"
    print_status "Overlay directory: $overlay_dir"

    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$namespace" > /dev/null 2>&1; then
        print_status "Creating namespace: $namespace"
        kubectl create namespace "$namespace"
    fi

    # Apply manifests
    print_status "Applying Kubernetes manifests..."
    cd "$overlay_dir"

    # Dry run first
    if [ "$DRY_RUN" = "true" ]; then
        print_status "Dry run - showing what would be deployed:"
        kustomize build . | kubectl apply --dry-run=client -f -
        return
    fi

    # Apply changes
    kustomize build . | kubectl apply -f -

    print_status "Deployment completed"
}

# Wait for deployment to be ready
wait_for_deployment() {
    local environment=${1:-$DEFAULT_ENVIRONMENT}
    local namespace=${NAMESPACE:-$DEFAULT_NAMESPACE}
    local timeout=${DEPLOYMENT_TIMEOUT:-300}

    print_header "Waiting for Deployment"

    local components=("bore-backend" "bore-server" "postgres" "redis")

    for component in "${components[@]}"; do
        print_status "Waiting for $component to be ready..."

        if kubectl wait --for=condition=available --timeout=${timeout}s \
            deployment/${component} -n "$namespace"; then
            print_status "✅ $component is ready"
        else
            print_error "❌ $component failed to become ready within ${timeout}s"
            return 1
        fi
    done

    print_status "All components are ready"
}

# Show deployment status
show_status() {
    local namespace=${NAMESPACE:-$DEFAULT_NAMESPACE}

    print_header "Deployment Status"

    print_status "Pods:"
    kubectl get pods -n "$namespace" -o wide

    print_status "\nServices:"
    kubectl get services -n "$namespace"

    print_status "\nIngress:"
    kubectl get ingress -n "$namespace" 2>/dev/null || print_warning "No Ingress resources found"

    print_status "\nPersistent Volumes:"
    kubectl get pvc -n "$namespace"
}

# Show access information
show_access_info() {
    local environment=${1:-$DEFAULT_ENVIRONMENT}
    local namespace=${NAMESPACE:-$DEFAULT_NAMESPACE}

    print_header "Access Information"

    if [ "$environment" = "development" ]; then
        print_status "Development Access:"

        # Get LoadBalancer IPs for development services
        local backend_ip=$(kubectl get service bore-backend-debug -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
        local server_ip=$(kubectl get service bore-server-debug -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")

        print_status "Backend API: http://$backend_ip:3000"
        print_status "Bore Server: $server_ip:7835"
        print_status "PostgreSQL: postgresql://postgres:password@$backend_ip:5432/bore_db"
        print_status "Redis: redis://:$server_ip:6379"
    else
        print_status "Production Access:"

        # Get Ingress hostnames
        local backend_host=$(kubectl get ingress bore-ingress -n "$namespace" -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "pending")
        local grafana_host=$(kubectl get ingress bore-ingress -n "$namespace" -o jsonpath='{.spec.rules[1].host}' 2>/dev/null || echo "pending")

        print_status "Backend API: https://$backend_host"
        print_status "Grafana: https://$grafana_host"
    fi

    print_status "\nCommands:"
    print_status "  kubectl logs -f deployment/bore-backend -n $namespace"
    print_status "  kubectl port-forward service/bore-backend-service 3000:3000 -n $namespace"
    print_status "  kubectl exec -it deployment/bore-backend -n $namespace -- /bin/bash"
}

# Cleanup deployment
cleanup() {
    local environment=${1:-$DEFAULT_ENVIRONMENT}
    local namespace=${NAMESPACE:-$DEFAULT_NAMESPACE}

    print_header "Cleaning Up Deployment"

    local overlay_dir="$SCRIPT_DIR/overlays/$environment"

    if [ ! -d "$overlay_dir" ]; then
        print_error "Environment overlay not found: $overlay_dir"
        exit 1
    fi

    if [ "$FORCE_CLEANUP" != "true" ]; then
        read -p "Are you sure you want to delete the entire '$environment' deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleanup cancelled"
            return
        fi
    fi

    print_status "Deleting Kubernetes resources..."
    cd "$overlay_dir"

    kustomize build . | kubectl delete -f - --ignore-not-found=true

    if [ "$DELETE_NAMESPACE" = "true" ]; then
        print_status "Deleting namespace: $namespace"
        kubectl delete namespace "$namespace" --ignore-not-found=true
    fi

    print_status "Cleanup completed"
}

# Show help
show_help() {
    echo "Bore Kubernetes Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy               Deploy Bore to Kubernetes"
    echo "  status               Show deployment status"
    echo "  access               Show access information"
    echo "  cleanup              Clean up deployment"
    echo "  build                Build Docker images only"
    echo "  help                 Show this help message"
    echo ""
    echo "Options:"
    echo "  -e, --env ENVIRONMENT    Environment (development|production) [default: development]"
    echo "  -n, --namespace NAMESPACE Kubernetes namespace [default: bore-system]"
    echo "  -r, --registry REGISTRY   Docker registry [default: localhost:5000]"
    echo "  -v, --version VERSION     Image version [default: latest]"
    echo "  --skip-build             Skip Docker build"
    echo "  --push-images            Push images to registry"
    echo "  --dry-run                Show what would be deployed without applying"
    echo "  --timeout SECONDS        Deployment timeout [default: 300]"
    echo "  --force-cleanup          Skip confirmation for cleanup"
    echo "  --delete-namespace       Delete namespace during cleanup"
    echo ""
    echo "Environment Variables:"
    echo "  ENVIRONMENT             Environment name"
    echo "  NAMESPACE               Kubernetes namespace"
    echo "  DOCKER_REGISTRY         Docker registry URL"
    echo "  VERSION                 Image version"
    echo "  SKIP_BUILD              Skip building images"
    echo "  PUSH_IMAGES             Push images to registry"
    echo "  DRY_RUN                 Dry run mode"
    echo "  DEPLOYMENT_TIMEOUT      Deployment timeout"
    echo "  FORCE_CLEANUP           Force cleanup without confirmation"
    echo "  DELETE_NAMESPACE        Delete namespace on cleanup"
    echo ""
    echo "Examples:"
    echo "  $0 deploy -e development               # Deploy development environment"
    echo "  $0 deploy -e production --push-images   # Deploy production with images"
    echo "  $0 status -e production                 # Show production status"
    echo "  $0 cleanup -e development --force-cleanup  # Clean development environment"
}

# Main execution
main() {
    local command=${1:-help}
    shift

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -r|--registry)
                DOCKER_REGISTRY="$2"
                shift 2
                ;;
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --push-images)
                PUSH_IMAGES=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --timeout)
                DEPLOYMENT_TIMEOUT="$2"
                shift 2
                ;;
            --force-cleanup)
                FORCE_CLEANUP=true
                shift
                ;;
            --delete-namespace)
                DELETE_NAMESPACE=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Set defaults
    local environment=${ENVIRONMENT:-$DEFAULT_ENVIRONMENT}
    local namespace=${NAMESPACE:-$DEFAULT_NAMESPACE}

    case $command in
        deploy)
            check_prerequisites
            build_and_push_images "$environment"
            deploy_to_k8s "$environment"

            if [ "$DRY_RUN" != "true" ]; then
                wait_for_deployment "$environment"
                show_status
                show_access_info "$environment"
            fi
            ;;
        status)
            show_status
            show_access_info "$environment"
            ;;
        access)
            show_access_info "$environment"
            ;;
        cleanup)
            cleanup "$environment"
            ;;
        build)
            build_and_push_images "$environment"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"