# ==============================================================================
# File: modules/main.tf
# Purpose: Reusable VM module logic.
# Role: Defines the core resources for a Linux Virtual Machine, including 
#       Network Interfaces (NICs) and their security group associations.
# ==============================================================================

# Create the Network Interface (NIC) for the VM
resource "azurerm_network_interface" "nic" {
  name                = "${var.vm_name}-nic"
  location            = var.location
  resource_group_name = var.rg_name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = var.subnet_id
    private_ip_address_allocation = var.static_private_ip != "" ? "Static" : "Dynamic"
    private_ip_address            = var.static_private_ip != "" ? var.static_private_ip : null
    public_ip_address_id          = var.public_ip_id
  }
}

resource "azurerm_network_interface_security_group_association" "nsg_assoc" {
  network_interface_id      = azurerm_network_interface.nic.id
  network_security_group_id = var.nsg_id
}

# Define the Linux Virtual Machine
resource "azurerm_linux_virtual_machine" "vm" {
  name                  = var.vm_name
  resource_group_name   = var.rg_name
  location              = var.location
  size                  = var.vm_size
  admin_username        = "azureuser"
  network_interface_ids = [azurerm_network_interface.nic.id]
  custom_data           = var.custom_data

  # SSH configuration for secure access
  admin_ssh_key {
    username   = "azureuser"
    public_key = var.ssh_public_key
  }

  # OS Disk settings using Standard LRS for cost-efficiency
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  # Use Ubuntu 22.04 LTS as the base image
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
}
