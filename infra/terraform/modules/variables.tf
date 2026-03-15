variable "vm_name" {}
variable "location" {}
variable "rg_name" {}
variable "vm_size" {}
variable "subnet_id" {}
variable "nsg_id" {}
variable "ssh_public_key" {}
variable "custom_data" {}
variable "static_private_ip" { default = "" }
variable "public_ip_id" { default = null }