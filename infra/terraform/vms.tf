resource "azurerm_network_security_group" "gateway_nsg" {
  name                = "${var.resource_prefix}-gateway-nsg"
  location            = var.region_a
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "Allow-HTTP-8000"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8000"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
  
  security_rule {
    name                       = "Allow-HTTPS-443"
    priority                   = 105
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "Allow-HTTP-80"
    priority                   = 106
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "Allow-SSH-Inbound"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_security_group" "internal_nsg_a" {
  name                = "${var.resource_prefix}-internal-nsg-a"
  location            = var.region_a
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_network_security_group" "internal_nsg_b" {
  name                = "${var.resource_prefix}-internal-nsg-b"
  location            = var.region_b
  resource_group_name = azurerm_resource_group.rg.name
}

# ==========================================
# REGION A (4 vCPUs)
# ==========================================

module "gateway_vm" {
  source           = "./modules"
  vm_name          = "${var.resource_prefix}-gateway"
  location         = var.region_a
  rg_name          = azurerm_resource_group.rg.name
  vm_size          = "Standard_B2ats_v2"
  subnet_id        = azurerm_subnet.subnet_a.id
  nsg_id           = azurerm_network_security_group.gateway_nsg.id
  public_ip_id     = azurerm_public_ip.gateway_ip.id
  static_private_ip = "10.0.1.10"
  ssh_public_key   = tls_private_key.vm_ssh_key.public_key_openssh
  custom_data      = null
}

module "joke_vm" {
  source           = "./modules"
  vm_name          = "${var.resource_prefix}-joke"
  location         = var.region_a
  rg_name          = azurerm_resource_group.rg.name
  vm_size          = "Standard_B2ats_v2"
  subnet_id        = azurerm_subnet.subnet_a.id
  nsg_id           = azurerm_network_security_group.internal_nsg_a.id
  static_private_ip = "10.0.1.11"
  ssh_public_key   = tls_private_key.vm_ssh_key.public_key_openssh
  custom_data      = null
}

# ==========================================
# REGION B (3 vCPUs)
# ==========================================

module "broker_vm" {
  source           = "./modules"
  vm_name          = "${var.resource_prefix}-broker"
  location         = var.region_b
  rg_name          = azurerm_resource_group.rg.name
  vm_size          = "Standard_B2ats_v2"
  subnet_id        = azurerm_subnet.subnet_b.id
  nsg_id           = azurerm_network_security_group.internal_nsg_b.id
  static_private_ip = "10.1.1.10"
  ssh_public_key   = tls_private_key.vm_ssh_key.public_key_openssh
  custom_data      = null
}

module "submit_vm" {
  source           = "./modules"
  vm_name          = "${var.resource_prefix}-submit"
  location         = var.region_b
  rg_name          = azurerm_resource_group.rg.name
  vm_size          = "Standard_B2ats_v2"
  subnet_id        = azurerm_subnet.subnet_b.id
  nsg_id           = azurerm_network_security_group.internal_nsg_b.id
  static_private_ip = "10.1.1.11"
  ssh_public_key   = tls_private_key.vm_ssh_key.public_key_openssh
  custom_data      = null
}

module "moderate_vm" {
  source           = "./modules"
  vm_name          = "${var.resource_prefix}-moderate"
  location         = var.region_b
  rg_name          = azurerm_resource_group.rg.name
  vm_size          = "Standard_B2ats_v2"
  subnet_id        = azurerm_subnet.subnet_b.id
  nsg_id           = azurerm_network_security_group.internal_nsg_b.id
  static_private_ip = "10.1.1.12"
  ssh_public_key   = tls_private_key.vm_ssh_key.public_key_openssh
  custom_data      = null
}