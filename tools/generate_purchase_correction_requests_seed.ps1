$ErrorActionPreference = 'Stop'

function Convert-CsvToJson($path, $map) {
  $rows = @(Import-Csv -Path $path | ForEach-Object {
    $o = [ordered]@{}
    foreach ($entry in $map.GetEnumerator()) {
      $o[$entry.Key] = [string]($_.($entry.Value))
    }
    $o
  })
  return (ConvertTo-Json -InputObject $rows -Compress -Depth 30)
}

$purchaseRequestsJson = Convert-CsvToJson 'docs/base_44_export/SolicitacaoCompra_export.csv' ([ordered]@{
  legacy_purchase_request_id='id'; items='itens'; requester='solicitante'; authorization_date='data_autorizacao'; legacy_purchase_id='compra_id'; request_number='numero_solicitacao'; legacy_service_order_id='ordem_servico_id'; notes='observacoes'; request_date='data_solicitacao'; legacy_supplier_id='fornecedor_id'; rejection_reason='motivo_recusa'; legacy_org_id='organization_id'; justification='justificativa'; total_request_amount='valor_total_solicitacao'; status='status'; authorized_by='autorizado_por'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$correctionRequestsJson = Convert-CsvToJson 'docs/base_44_export/SolicitacaoCorrecaoOS_export.csv' ([ordered]@{
  legacy_correction_request_id='id'; approved_by='aprovado_por'; requester_email='solicitante_email'; service_order_number='numero_os'; legacy_responsible_id='responsavel_id'; completion_date='data_conclusao'; description='descricao'; requester_name='solicitante_nome'; legacy_service_order_id='ordem_servico_id'; legacy_org_id='organization_id'; updated_by='updated_by'; approval_date='data_aprovacao'; resolution_notes='observacao_resolucao'; status='status'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})

$template = Get-Content -Raw -Path 'tools/purchase_correction_requests_seed_template.sql'
$sql = $template.
  Replace('__PURCHASE_REQUESTS_JSON__', $purchaseRequestsJson).
  Replace('__CORRECTION_REQUESTS_JSON__', $correctionRequestsJson)

$legacyOutputPath = Join-Path (Get-Location) 'supabase/seeders/migrate/008_purchase_and_correction_requests_seed.sql'
if (Test-Path $legacyOutputPath) {
  Remove-Item -Path $legacyOutputPath
}

$outputPath = Join-Path (Get-Location) 'supabase/seeders/migrate/011_purchase_and_correction_requests_seed.sql'
[System.IO.File]::WriteAllText($outputPath, $sql, [System.Text.UTF8Encoding]::new($false))
