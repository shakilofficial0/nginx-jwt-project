# Nginx NJS JWT Image Auth - Ubuntu Installation Guide

A comprehensive guide to install and set up Nginx with JWT authentication on Ubuntu, protecting image files behind token validation. This guide covers standalone installation on Ubuntu (both with and without Docker).

***

## Table of Contents

1. [Repository Information](#repository-information)
2. [Prerequisites](#prerequisites)
3. [Option A: Docker Compose Setup on Ubuntu](#option-a-docker-compose-setup-on-ubuntu)
4. [Option B: Native Nginx Installation on Ubuntu](#option-b-native-nginx-installation-on-ubuntu)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

***

## Repository Information

All configuration files and project structure are available in the demo repository:

```
Repository URL: https://github.com/demo-repo/nginx-jwt-project
Clone: git clone https://github.com/demo-repo/nginx-jwt-project.git
```

This guide uses configuration files from this repository. You can:
- Clone the entire repository for a complete setup
- Copy individual configuration files as needed
- Download files via the GitHub web interface

**Files included in the repository:**
- `docker-compose.yml` — Docker Compose configuration
- `Dockerfile` — Nginx with NJS module build definition
- `nginx/nginx.conf` — Main Nginx configuration
- `nginx/conf.d/default.conf` — Server block and routing configuration
- `nginx/njs/auth.js` — JWT verification script
- `Readme.md` — Original project documentation
- `readme-ubuntu.md` — This Ubuntu-specific installation guide

***

## Prerequisites

### System Requirements

- **Ubuntu 20.04 LTS, 22.04 LTS, or 24.04 LTS** (recommended: 22.04 LTS or newer)
- **4GB RAM** minimum
- **10GB free disk space** minimum
- **sudo** access

### Check Your Ubuntu Version

```bash
lsb_release -a
# or
cat /etc/os-release
```

***

## Option A: Docker Compose Setup on Ubuntu

This is the **recommended approach** for production deployments.

### Step 1: Install Docker and Docker Compose

```bash
# Update package manager
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y docker.io

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group (optional, but recommended)
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker installation
docker --version
```

**Expected output:**
```
Docker version 24.0.x or higher
```

### Step 2: Install Docker Compose

```bash
# Install Docker Compose (v2.x comes with newer Docker, but ensure it's installed)
sudo apt-get install -y docker-compose-plugin

# Verify installation
docker compose version
```

**Expected output:**
```
Docker Compose version v2.x.x
```

### Step 3: Clone the Repository

Clone the project files from the demo repository:

```bash
# Clone the repository
git clone https://github.com/demo-repo/nginx-jwt-project.git ~/nginx-jwt-project
cd ~/nginx-jwt-project

# Verify project structure
ls -la
```

**Expected output:**
```
docker-compose.yml
Dockerfile
Readme.md
readme-ubuntu.md
nginx/
├── nginx.conf
├── conf.d/
│   └── default.conf
└── njs/
    └── auth.js
images/
```

### Step 4: Verify Configuration Files

The configuration files are already included in the repository. Verify they exist:

```bash
# Check all files are present
ls -la docker-compose.yml Dockerfile
ls -la nginx/nginx.conf nginx/conf.d/default.conf nginx/njs/auth.js

# If you cloned successfully, you should see all these files
```

#### 4.1 Review `docker-compose.yml`

```bash
cat docker-compose.yml
```

This file defines the Docker Compose service configuration for Nginx with volume mounts.

#### 4.2 Review `Dockerfile`

```bash
cat Dockerfile
```

This file installs Nginx with the NJS module from the official Nginx repository.

#### 4.3 Review `nginx/nginx.conf`

```bash
cat nginx/nginx.conf
```

Main Nginx configuration that loads the NJS dynamic module and sets up basic HTTP directives.

#### 4.4 Review `nginx/conf.d/default.conf`

```bash
cat nginx/conf.d/default.conf
```

Server block configuration that handles:
- Health check endpoint (`/health`)
- Protected image endpoint with JWT authentication
- Internal auth subrequest handler

#### 4.5 Review `nginx/njs/auth.js`

```bash
cat nginx/njs/auth.js
```

NJS script that implements JWT verification logic including:
- Token extraction from headers/query parameters
- HMAC-SHA256 signature verification
- Token expiration checking
- User ID validation against URL path

### Step 5: Create Test Images

The `images/` directory should already exist in the cloned repository. If not, create it:

```bash
# Create images directory if it doesn't exist
mkdir -p images

# Install ImageMagick for creating test images
sudo apt-get install -y imagemagick

# Create simple test PNG images
convert -size 200x200 xc:blue images/42_image.png
convert -size 200x200 xc:red images/99_image.png
convert -size 200x200 xc:green images/john_image.png

# Verify images were created
ls -lh images/
```

**Expected output:**
```
-rw-r--r-- 1 user user 456 Jun  7 10:15 42_image.png
-rw-r--r-- 1 user user 456 Jun  7 10:15 99_image.png
-rw-r--r-- 1 user user 456 Jun  7 10:15 john_image.png
```

### Step 6: Build and Start Services

```bash
# Build the Docker image
docker compose build

# Start services in background
docker compose up -d

# Wait a few seconds for services to initialize
sleep 3

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

**Expected output from `docker compose ps`:**
```
CONTAINER ID   IMAGE                         STATUS       PORTS
abc123...      nginx-jwt-project-nginx_jwt   Up 2 seconds 0.0.0.0:80->80/tcp
```

### Step 7: Verify Installation

```bash
# Test health endpoint (should return 200)
curl -i http://localhost/health

# Expected: HTTP/1.1 200 OK
```

***

## Option B: Native Nginx Installation on Ubuntu

For development or systems without Docker.

### Step 1: Install Nginx with NJS Module

```bash
# Update package manager
sudo apt-get update
sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y curl gnupg2 ca-certificates lsb-release

# Add Nginx official repository signing key
curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor | sudo tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null

# Add Nginx official repository
echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/mainline/ubuntu $(lsb_release -cs) nginx" | \
  sudo tee /etc/apt/sources.list.d/nginx.list

# Update package manager again
sudo apt-get update

# Install Nginx with NJS module
sudo apt-get install -y nginx-module-njs

# Verify installation
nginx -v
```

**Expected output:**
```
nginx version: nginx/1.27.x
```

### Step 2: Clone Repository and Prepare Directories

```bash
# Clone the demo repository
git clone https://github.com/demo-repo/nginx-jwt-project.git /tmp/nginx-jwt-setup
cd /tmp/nginx-jwt-setup

# Create nginx configuration directories
sudo mkdir -p /etc/nginx/njs
sudo mkdir -p /var/www/html/images

# Create test images
sudo apt-get install -y imagemagick

sudo convert -size 200x200 xc:blue /var/www/html/images/42_image.png
sudo convert -size 200x200 xc:red /var/www/html/images/99_image.png
sudo convert -size 200x200 xc:green /var/www/html/images/john_image.png

# Set proper permissions
sudo chown -R www-data:www-data /var/www/html/images
sudo chmod 755 /var/www/html/images
sudo chmod 644 /var/www/html/images/*.png
```

### Step 3: Configure Nginx

#### 3.1 Backup Original Config

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
```

#### 3.2 Copy Main Nginx Config from Repository

```bash
# Copy the nginx.conf from cloned repository
sudo cp /tmp/nginx-jwt-setup/nginx/nginx.conf /etc/nginx/nginx.conf

# Verify the file was copied
cat /etc/nginx/nginx.conf | head -20
```

#### 3.3 Copy Server Configuration from Repository

```bash
# Copy the server config file
sudo cp /tmp/nginx-jwt-setup/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Verify the file
cat /etc/nginx/conf.d/default.conf | head -20
```

#### 3.4 Copy NJS Authentication Script from Repository

```bash
# Copy the auth.js script
sudo cp /tmp/nginx-jwt-setup/nginx/njs/auth.js /etc/nginx/njs/auth.js

# Set proper permissions
sudo chown root:root /etc/nginx/njs/auth.js
sudo chmod 644 /etc/nginx/njs/auth.js

# Verify the file
cat /etc/nginx/njs/auth.js | head -20
```

### Step 4: Test and Start Nginx

```bash
# Test Nginx configuration
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Start Nginx service
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx

# Verify it's running
curl -i http://localhost/health
```

***

## Configuration

### Changing the JWT Secret

Edit the configuration file based on your setup:

**Docker Compose:**
```bash
# Edit the NJS script
nano nginx/njs/auth.js

# Change this line:
var JWT_SECRET = "your-new-secret-key-here";

# Restart services
docker compose restart
```

**Native Installation:**
```bash
# Edit the NJS script
sudo nano /etc/nginx/njs/auth.js

# Change this line:
var JWT_SECRET = "your-new-secret-key-here";

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Supported JWT Algorithms

The script supports:
- `HS256` (HMAC with SHA-256) — **default**
- `HS384` (HMAC with SHA-384)
- `HS512` (HMAC with SHA-512)

Change by modifying `JWT_ALGORITHM` in `auth.js`.

### URL Pattern Reference

| Request URL | File Served | Notes |
|---|---|---|
| `/micro_images/42_images.png` | `/var/www/html/images/42_image.png` | URL uses `_images` (plural) |
| `/micro_images/john_images.png` | `/var/www/html/images/john_image.png` | File uses `_image` (singular) |
| `/micro_images/usr_99_images.png` | `/var/www/html/images/usr_99_image.png` | Can include underscores in user_id |

***

## Testing

### Create a Test JWT Token

Install Python JWT library:

```bash
sudo apt-get install -y python3 python3-pip
pip3 install pyjwt
```

Create a token generation script:

```bash
cat > gen_token.py << 'EOF'
#!/usr/bin/env python3
import hmac
import hashlib
import base64
import json
import time
import sys

def b64url(data: bytes) -> str:
    """Encode bytes to base64url string (no padding)"""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def generate_jwt(user_id, secret, exp_seconds=3600):
    """Generate an HS256 JWT token"""
    secret_str = secret
    
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64url(json.dumps({
        "user_id": str(user_id),
        "exp": int(time.time()) + exp_seconds
    }).encode())
    
    signing_input = f"{header}.{payload}"
    signature = b64url(
        hmac.new(secret_str.encode(), signing_input.encode(), hashlib.sha256).digest()
    )
    
    token = f"{signing_input}.{signature}"
    return token

if __name__ == "__main__":
    secret = "i-hate-my-job-because-nginx-jwt-does-work"
    user_id = sys.argv[1] if len(sys.argv) > 1 else "42"
    
    token = generate_jwt(user_id, secret)
    print(token)
EOF

chmod +x gen_token.py
```

### Test Case 1: Valid Request with Authorization Header

```bash
# Generate token for user 42
TOKEN=$(python3 gen_token.py 42)

echo "Token: $TOKEN"

# Test the request
curl -v \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/micro_images/42_images.png \
  -o /tmp/test_image.png

# Check file was downloaded
file /tmp/test_image.png
ls -lh /tmp/test_image.png
```

**Expected response:**
```
< HTTP/1.1 200 OK
< Content-Type: image/png
< Content-Length: 456
```

### Test Case 2: Valid Request with Query Parameter

```bash
TOKEN=$(python3 gen_token.py 99)

curl -v \
  "http://localhost/micro_images/99_images.png?token=$TOKEN" \
  -o /tmp/test_image_99.png

# Expected: HTTP/1.1 200 OK
```

### Test Case 3: Missing Token (401 Error)

```bash
curl -v http://localhost/micro_images/42_images.png

# Expected response:
# < HTTP/1.1 401 Unauthorized
# {"error":"Unauthorized","message":"Missing or invalid JWT token"}
```

### Test Case 4: User ID Mismatch (403 Error)

```bash
# Generate token for user 42
TOKEN=$(python3 gen_token.py 42)

# Request for user 99 with token for user 42
curl -v \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/micro_images/99_images.png

# Expected response:
# < HTTP/1.1 403 Forbidden
# {"error":"Forbidden","message":"Token user_id does not match resource user_id"}
```

### Test Case 5: Invalid/Tampered Token

```bash
curl -v \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiNDIifQ.INVALIDSIG" \
  http://localhost/micro_images/42_images.png

# Expected response:
# < HTTP/1.1 401 Unauthorized
```

### Test Case 6: Expired Token

Create a token that's already expired:

```bash
cat > gen_expired_token.py << 'EOF'
#!/usr/bin/env python3
import hmac
import hashlib
import base64
import json

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

secret = "i-hate-my-job-because-nginx-jwt-does-work"
header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
payload = b64url(json.dumps({
    "user_id": "42",
    "exp": 1000000000  # Past date
}).encode())

signing_input = f"{header}.{payload}"
signature = b64url(
    hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
)

token = f"{signing_input}.{signature}"
print(token)
EOF

EXPIRED_TOKEN=$(python3 gen_expired_token.py)

curl -v \
  -H "Authorization: Bearer $EXPIRED_TOKEN" \
  http://localhost/micro_images/42_images.png

# Expected response:
# < HTTP/1.1 401 Unauthorized
```

### Test Case 7: Non-GET Request (405 Error)

```bash
TOKEN=$(python3 gen_token.py 42)

curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/micro_images/42_images.png

# Expected response:
# < HTTP/1.1 405 Method Not Allowed
```

***

## Troubleshooting

### Docker Compose Issues

#### Service won't start

```bash
# Check logs
docker compose logs nginx_jwt

# Common issues:
# - Port 80 already in use: Change port in docker-compose.yml
# - Permission issues with image files: Ensure ./images directory exists with files
```

#### Permission denied on mounted volumes

```bash
# Fix permissions
sudo chown $USER:$USER nginx/
sudo chown $USER:$USER images/

# Restart services
docker compose restart
```

#### Module not found error

```bash
# Rebuild the image
docker compose build --no-cache
docker compose up -d
```

### Native Nginx Issues

#### Nginx won't start

```bash
# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Common issues:
# - Port 80 in use: Check with `sudo netstat -tlnp | grep :80`
# - Permission denied: Ensure www-data user exists and has proper permissions
```

#### NJS module not loading

```bash
# Check if module is installed
ls -la /usr/share/nginx/modules-available/ | grep njs

# If not installed:
sudo apt-get install --reinstall nginx-module-njs

# Reload Nginx
sudo systemctl reload nginx
```

#### JWT token not validating

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify JWT_SECRET matches in auth.js and token generator
# Test with a manually created token

# Check JSON parsing:
cat nginx/njs/auth.js | grep -A 5 "JSON.parse"
```

#### File not found (404) despite valid token

```bash
# Verify image files exist
ls -la /var/www/html/images/

# Check naming convention (must be {user_id}_image.png, not _images.png)
# Check permissions
ls -l /var/www/html/images/*

# Should show:
# -rw-r--r-- 1 www-data www-data ... 42_image.png
```

### Monitoring and Logs

#### View Real-time Logs

**Docker Compose:**
```bash
docker compose logs -f nginx_jwt
```

**Native Installation:**
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log

# Filter for auth requests
sudo grep "auth" /var/log/nginx/access.log
```

#### Performance Metrics

```bash
# Check if Nginx is running smoothly
ps aux | grep nginx

# Check open connections
sudo netstat -tlnp | grep nginx

# Monitor resource usage
top -p $(pgrep -f 'nginx: master')
```

### Security Checks

```bash
# Verify files are read-only
ls -la /var/www/html/images/
# Should show permissions like: -rw-r--r--

# Verify Nginx is running as www-data (not root)
ps aux | grep nginx | grep -v grep
# Should show: www-data ... nginx: worker process

# Check if auth endpoints are internal
curl -v http://localhost/auth
# Should return 404 (internal endpoint not accessible)
```

***

## Production Deployment Checklist

- [ ] Change `JWT_SECRET` to a strong, randomly generated secret
- [ ] Use HTTPS with a valid SSL certificate (Let's Encrypt)
- [ ] Configure firewall rules to restrict access to port 80/443
- [ ] Set up log rotation for Nginx logs
- [ ] Configure monitoring and alerting
- [ ] Implement rate limiting on auth endpoint
- [ ] Use Docker secrets for sensitive data (if using Docker)
- [ ] Enable SELinux or AppArmor policies
- [ ] Regular backup of configuration files
- [ ] Keep Nginx and system packages updated
- [ ] Set up automated security scanning

***

## Additional Resources

- [Nginx Official Documentation](https://nginx.org/en/docs/)
- [NGINX NJS Documentation](https://nginx.org/en/docs/njs/)
- [JWT.io - JWT Documentation](https://jwt.io)
- [Docker Documentation](https://docs.docker.com)
- [Ubuntu Server Guide](https://ubuntu.com/server/docs)

