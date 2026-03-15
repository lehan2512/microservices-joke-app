output "gateway_public_ip" {
  value       = azurerm_public_ip.gateway_ip.ip_address
  description = "Your single HTTP origin."
}

output "gateway_fqdn" {
  value       = azurerm_public_ip.gateway_ip.fqdn
  description = "The domain name for Certbot HTTPS"
}

output "joke_private_ip" {
  value       = module.joke_vm.private_ip
  description = "Use this in kong.yaml to route /joke-api traffic"
}

output "submit_private_ip" {
  value       = module.submit_vm.private_ip
  description = "Use this in kong.yaml to route /submit-api traffic"
}

output "moderate_private_ip" {
  value       = module.moderate_vm.private_ip
  description = "Use this in kong.yaml to route /moderate-api traffic"
}

output "broker_private_ip" {
  value       = module.broker_vm.private_ip
  description = "Pass this to your Node apps as amqp://<this-ip>"
}