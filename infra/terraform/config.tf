# ==============================================================================
# File: config.tf
# Purpose: Global variable definitions for the Joke App infrastructure.
# Role: Provides a centralized location for configuration settings such as 
#       resource naming prefixes and regional deployments.
# ==============================================================================

# Prefix used to ensure unique naming for all Azure resources
variable "resource_prefix" {
  type        = string
  description = "Prefix for all resources"
  default     = "lehan-joke"
}

variable "region_a" {
  type        = string
  description = "Primary Region (Gateway, Joke DB, Jumpbox) - Max 4 vCPUs"
  default     = "eastasia" 
}

variable "region_b" {
  type        = string
  description = "Secondary Region (Submit, Moderate, RabbitMQ) - Max 4 vCPUs"
  default     = "malaysiawest"
}
