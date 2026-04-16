#!/usr/bin/env bash
# =============================================================================
# ZuzuFlow — One-time Ubuntu Server Provisioning Script
# Tested on: Ubuntu 22.04 / 24.04 LTS
# Requirements: 8GB+ RAM, 4+ vCPUs, root/sudo access
# =============================================================================
set -euo pipefail

echo "============================================="
echo "  ZuzuFlow Server Setup"
echo "============================================="

# ---------------------------------------------------------------------------
# 1. System updates
# ---------------------------------------------------------------------------
echo "[1/9] Updating system packages..."
apt update && apt upgrade -y
apt install -y curl wget git apt-transport-https ca-certificates \
    software-properties-common gnupg lsb-release apache2-utils

# ---------------------------------------------------------------------------
# 2. Install Docker
# ---------------------------------------------------------------------------
echo "[2/9] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
    echo "Docker installed."
else
    echo "Docker already installed, skipping."
fi

# ---------------------------------------------------------------------------
# 3. Install k3s (lightweight Kubernetes)
# ---------------------------------------------------------------------------
echo "[3/9] Installing k3s..."
if ! command -v k3s &> /dev/null; then
    curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--docker --disable=traefik" sh -
    # Configure kubectl for current user
    mkdir -p ~/.kube
    cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
    chmod 600 ~/.kube/config
    echo "k3s installed."
else
    echo "k3s already installed, skipping."
fi

# Verify k3s
kubectl get nodes

# ---------------------------------------------------------------------------
# 4. Local Docker Registry
# ---------------------------------------------------------------------------
echo "[4/9] Setting up local Docker registry..."
if ! docker ps --format '{{.Names}}' | grep -q '^registry$'; then
    docker run -d --restart=always -p 5000:5000 --name registry registry:2
    echo "Local registry started on port 5000."
else
    echo "Registry already running, skipping."
fi

# Configure Docker to trust local registry
DAEMON_JSON=/etc/docker/daemon.json
if [ ! -f "$DAEMON_JSON" ] || ! grep -q "insecure-registries" "$DAEMON_JSON"; then
    cat > "$DAEMON_JSON" <<EOF
{
    "insecure-registries": ["localhost:5000"]
}
EOF
    systemctl restart docker
    echo "Docker configured for local registry."
fi

# ---------------------------------------------------------------------------
# 5. Install Nginx
# ---------------------------------------------------------------------------
echo "[5/9] Installing Nginx..."
apt install -y nginx
systemctl enable nginx

# ---------------------------------------------------------------------------
# 6. Install Certbot
# ---------------------------------------------------------------------------
echo "[6/9] Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# ---------------------------------------------------------------------------
# 7. Install Jenkins
# ---------------------------------------------------------------------------
echo "[7/9] Installing Jenkins..."
if ! command -v jenkins &> /dev/null; then
    # Install Java 17
    apt install -y fontconfig openjdk-17-jre

    # Add Jenkins repo (key updated Dec 2025 → jenkins.io-2026.key)
    curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key | \
        tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
    echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | \
        tee /etc/apt/sources.list.d/jenkins.list > /dev/null
    apt update && apt install -y jenkins

    # Change Jenkins port to 8081 (avoid conflict with Temporal UI on 8080)
    mkdir -p /etc/systemd/system/jenkins.service.d
    cat > /etc/systemd/system/jenkins.service.d/override.conf <<EOF
[Service]
Environment="JENKINS_PORT=8081"
EOF
    systemctl daemon-reload

    # Allow Jenkins to use Docker
    usermod -aG docker jenkins

    systemctl enable jenkins && systemctl start jenkins
    echo "Jenkins installed on port 8081."
else
    echo "Jenkins already installed, skipping."
fi

# ---------------------------------------------------------------------------
# 8. Configure kubectl for Jenkins
# ---------------------------------------------------------------------------
echo "[8/9] Configuring kubectl for Jenkins..."
mkdir -p /var/lib/jenkins/.kube
cp /etc/rancher/k3s/k3s.yaml /var/lib/jenkins/.kube/config
chown -R jenkins:jenkins /var/lib/jenkins/.kube
chmod 600 /var/lib/jenkins/.kube/config

# ---------------------------------------------------------------------------
# 9. Create Nginx htpasswd for Temporal UI
# ---------------------------------------------------------------------------
echo "[9/9] Setting up Temporal UI basic auth..."
if [ ! -f /etc/nginx/.htpasswd ]; then
    echo "Creating htpasswd for Temporal UI admin access..."
    echo "Enter password for Temporal UI 'admin' user:"
    htpasswd -c /etc/nginx/.htpasswd admin
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  Setup Complete!"
echo "============================================="
echo ""
echo "Services installed:"
echo "  - Docker:    $(docker --version)"
echo "  - k3s:       $(k3s --version 2>&1 | head -1)"
echo "  - Nginx:     $(nginx -v 2>&1)"
echo "  - Certbot:   $(certbot --version 2>&1)"
echo "  - Jenkins:   http://$(hostname -I | awk '{print $1}'):8081"
echo "  - Registry:  localhost:5000"
echo ""
echo "Next steps:"
echo "  1. Point DNS records to this server:"
echo "     - app.zuzuflow.com    → $(curl -s ifconfig.me)"
echo "     - zuzuflow.com        → $(curl -s ifconfig.me)"
echo "     - www.zuzuflow.com    → $(curl -s ifconfig.me)"
echo "     - temporal.zuzuflow.com → $(curl -s ifconfig.me)"
echo ""
echo "  2. Clone the repo + build the prebuilt isolated-vm base image:"
echo "     git clone <repo-url> ~/zuzuflow && cd ~/zuzuflow"
echo "     bash deploy/scripts/build-ivm.sh"
echo "     # Publishes localhost:5000/ivm-prebuilt:node24-ivm6.1.2 — referenced"
echo "     # at build-time by Dockerfile.workers. Rebuild only on Node / ivm bumps."
echo ""
echo "  3. Create k8s namespace and secrets:"
echo "     kubectl apply -f deploy/k8s/namespace.yaml"
echo "     kubectl create secret generic workflow-secrets -n workflow \\"
echo "       --from-literal=DATABASE_URL='postgresql://workflow:YOURPW@postgres-svc:5432/workflow_db' \\"
echo "       --from-literal=POSTGRES_USER='workflow' \\"
echo "       --from-literal=POSTGRES_PASSWORD='YOURPW' \\"
echo "       --from-literal=POSTGRES_DB='workflow_db' \\"
echo "       --from-literal=ENCRYPTION_KEY='your-32-char-encryption-key!!!!!' \\"
echo "       --from-literal=WEBHOOK_SECRET='your-32-char-webhook-secret!!!!!' \\"
echo "       --from-literal=API_TOKEN='your-secure-api-token-here!!!!' \\"
echo "       --from-literal=JWT_SECRET='your-jwt-secret-here-min16!!' \\"
echo "       --from-literal=INTERNAL_API_SECRET='your-internal-secret' \\"
echo "       --from-literal=INITIAL_ADMIN_PASSWORD='your-admin-password'"
echo ""
echo "  4. Deploy infrastructure:"
echo "     kubectl apply -f deploy/k8s/configmap.yaml"
echo "     kubectl apply -f deploy/k8s/pvc-postgres.yaml -f deploy/k8s/pvc-redis.yaml"
echo "     kubectl apply -f deploy/k8s/postgres.yaml"
echo "     kubectl apply -f deploy/k8s/redis.yaml"
echo "     kubectl apply -f deploy/k8s/temporal.yaml"
echo "     kubectl apply -f deploy/k8s/temporal-ui.yaml"
echo ""
echo "  5. Build & deploy applications (or use Jenkins)"
echo ""
echo "  6. Configure Nginx:"
echo "     cp deploy/nginx/zuzuflow.conf /etc/nginx/sites-available/"
echo "     ln -sf /etc/nginx/sites-available/zuzuflow.conf /etc/nginx/sites-enabled/"
echo "     rm -f /etc/nginx/sites-enabled/default"
echo "     nginx -t && systemctl reload nginx"
echo ""
echo "  7. Get SSL certificates:"
echo "     certbot --nginx -d app.zuzuflow.com -d zuzuflow.com -d www.zuzuflow.com -d temporal.zuzuflow.com"
echo ""
echo "  8. Get Jenkins initial admin password:"
echo "     cat /var/lib/jenkins/secrets/initialAdminPassword"
echo ""
