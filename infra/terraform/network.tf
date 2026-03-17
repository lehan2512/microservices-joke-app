# ==============================================================================
# File: network.tf
# Purpose: Defines the networking infrastructure on Azure.
# Role: Establishes Resource Groups, VNETs, Subnets, and VNET Peering to enable 
#       cross-region communication between microservices.
# ==============================================================================

# 1. The Core Resource Group
resource "azurerm_resource_group" "rg" {
  name     = "${var.resource_prefix}-rg"
  location = var.region_a # Metadata lives here, but resources can be anywhere
}

# ==========================================
# REGION A NETWORKING (Gateway, Joke, Jumpbox)
# ==========================================

resource "azurerm_virtual_network" "vnet_a" {
  name                = "${var.resource_prefix}-vnet-a"
  address_space       = ["10.0.0.0/16"]
  location            = var.region_a
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "subnet_a" {
  name                 = "${var.resource_prefix}-subnet-a"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet_a.name
  address_prefixes     = ["10.0.1.0/24"]
}

# Public IP for the Kong API Gateway 
resource "azurerm_public_ip" "gateway_ip" {
  name                = "${var.resource_prefix}-gateway-ip"
  location            = var.region_a
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = "${var.resource_prefix}" 
}

# ==========================================
# REGION B NETWORKING (Submit, Moderate, Broker)
# ==========================================

resource "azurerm_virtual_network" "vnet_b" {
  name                = "${var.resource_prefix}-vnet-b"
  address_space       = ["10.1.0.0/16"]
  location            = var.region_b
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "subnet_b" {
  name                 = "${var.resource_prefix}-subnet-b"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet_b.name
  address_prefixes     = ["10.1.1.0/24"]
}

# ==========================================
# VNET PEERING (The Bridge Between Regions)
# ==========================================

# Peer A -> B
resource "azurerm_virtual_network_peering" "peer_a_to_b" {
  name                      = "peer_a_to_b"
  resource_group_name       = azurerm_resource_group.rg.name
  virtual_network_name      = azurerm_virtual_network.vnet_a.name
  remote_virtual_network_id = azurerm_virtual_network.vnet_b.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
}

# Peer B -> A
resource "azurerm_virtual_network_peering" "peer_b_to_a" {
  name                      = "peer_b_to_a"
  resource_group_name       = azurerm_resource_group.rg.name
  virtual_network_name      = azurerm_virtual_network.vnet_b.name
  remote_virtual_network_id = azurerm_virtual_network.vnet_a.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
}