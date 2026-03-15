# ==========================================
# 1. GATEWAY DEPLOYMENT
# ==========================================
resource "null_resource" "deploy_gateway" {
  triggers = {
    compose_md5 = filemd5("../deploy/gateway-compose.yaml")
    kong_md5    = filemd5("../api-gateway/kong.yaml")
  }

  connection {
    type        = "ssh"
    user        = "azureuser"
    private_key = tls_private_key.vm_ssh_key.private_key_pem
    host        = azurerm_public_ip.gateway_ip.ip_address
  }

  provisioner "file" {
    source      = "../api-gateway/kong.yaml"
    destination = "/home/azureuser/kong.yaml"
  }

  provisioner "file" {
    source      = "../deploy/gateway-compose.yaml"
    destination = "/home/azureuser/docker-compose.yaml"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y docker.io docker-compose-v2 certbot",
      "sudo systemctl enable --now docker",
      "sudo usermod -aG docker azureuser",
      "sudo docker stop kong_gateway || true",
      "sudo certbot certonly --standalone -d ${azurerm_public_ip.gateway_ip.fqdn} --cert-name gateway --non-interactive --agree-tos -m student@university.edu || true"
    ]
  }

  depends_on = [module.gateway_vm, azurerm_public_ip.gateway_ip]
}

# ==========================================
# 2. JOKE DEPLOYMENT
# ==========================================
resource "null_resource" "deploy_joke" {
  triggers = {
    compose_md5 = filemd5("../deploy/joke-compose.yaml")
  }

  connection {
    type                = "ssh"
    user                = "azureuser"
    private_key         = tls_private_key.vm_ssh_key.private_key_pem
    host                = module.joke_vm.private_ip
    bastion_host        = azurerm_public_ip.gateway_ip.ip_address
    bastion_user        = "azureuser"
    bastion_private_key = tls_private_key.vm_ssh_key.private_key_pem
  }

  provisioner "file" {
    source      = "../deploy/joke-compose.yaml"
    destination = "/home/azureuser/docker-compose.yaml"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y docker.io docker-compose-v2",
      "sudo systemctl enable --now docker"
    ]
  }

  depends_on = [module.joke_vm, module.gateway_vm, azurerm_public_ip.gateway_ip]
}

# ==========================================
# 3. BROKER DEPLOYMENT
# ==========================================
resource "null_resource" "deploy_broker" {
  triggers = {
    compose_md5 = filemd5("../deploy/broker-compose.yaml")
  }

  connection {
    type                = "ssh"
    user                = "azureuser"
    private_key         = tls_private_key.vm_ssh_key.private_key_pem
    host                = module.broker_vm.private_ip
    bastion_host        = azurerm_public_ip.gateway_ip.ip_address
    bastion_user        = "azureuser"
    bastion_private_key = tls_private_key.vm_ssh_key.private_key_pem
  }

  provisioner "file" {
    source      = "../deploy/broker-compose.yaml"
    destination = "/home/azureuser/docker-compose.yaml"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y docker.io docker-compose-v2",
      "sudo systemctl enable --now docker"
    ]
  }

  depends_on = [module.broker_vm, module.gateway_vm, azurerm_public_ip.gateway_ip]
}

# ==========================================
# 4. SUBMIT DEPLOYMENT
# ==========================================
resource "null_resource" "deploy_submit" {
  triggers = {
    compose_md5 = filemd5("../deploy/submit-compose.yaml")
  }

  connection {
    type                = "ssh"
    user                = "azureuser"
    private_key         = tls_private_key.vm_ssh_key.private_key_pem
    host                = module.submit_vm.private_ip
    bastion_host        = azurerm_public_ip.gateway_ip.ip_address
    bastion_user        = "azureuser"
    bastion_private_key = tls_private_key.vm_ssh_key.private_key_pem
  }

  provisioner "file" {
    source      = "../deploy/submit-compose.yaml"
    destination = "/home/azureuser/docker-compose.yaml"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y docker.io docker-compose-v2",
      "sudo systemctl enable --now docker"
    ]
  }

  depends_on = [module.submit_vm, module.gateway_vm, azurerm_public_ip.gateway_ip]
}

# ==========================================
# 5. MODERATE DEPLOYMENT
# ==========================================
resource "null_resource" "deploy_moderate" {
  triggers = {
    compose_md5 = filemd5("../deploy/moderate-compose.yaml")
  }

  connection {
    type                = "ssh"
    user                = "azureuser"
    private_key         = tls_private_key.vm_ssh_key.private_key_pem
    host                = module.moderate_vm.private_ip
    bastion_host        = azurerm_public_ip.gateway_ip.ip_address
    bastion_user        = "azureuser"
    bastion_private_key = tls_private_key.vm_ssh_key.private_key_pem
  }

  provisioner "file" {
    source      = "../deploy/moderate-compose.yaml"
    destination = "/home/azureuser/docker-compose.yaml"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y docker.io docker-compose-v2",
      "sudo systemctl enable --now docker"
    ]
  }

  depends_on = [module.moderate_vm, module.gateway_vm, azurerm_public_ip.gateway_ip]
}