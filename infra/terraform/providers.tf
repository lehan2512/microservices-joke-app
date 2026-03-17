# ==============================================================================
# File: providers.tf
# Purpose: Configures the Terraform providers for the project.
# Role: Declares dependencies on Azure (azurerm) and TLS (tls) providers, 
# ==============================================================================

terraform {
  required_providers {
    # Azure Resource Manager provider for managing Azure infrastructure
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    # TLS provider for generating SSH keys locally during the plan/apply
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Provider configuration for Azure
provider "azurerm" {
  features {} 
  skip_provider_registration = true 
}