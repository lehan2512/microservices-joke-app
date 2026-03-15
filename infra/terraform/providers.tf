terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# This is the exact block Terraform is complaining about!
provider "azurerm" {
  features {} 
  
  # Highly recommended for Azure Student subscriptions to prevent random quota errors
  skip_provider_registration = true 
}