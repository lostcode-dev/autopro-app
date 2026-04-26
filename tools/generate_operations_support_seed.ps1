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

$appointmentsJson = Convert-CsvToJson 'docs/base_44_export/Agendamento_export.csv' ([ordered]@{
  legacy_appointment_id='id'; legacy_vehicle_id='veiculo_id'; legacy_service_order_id='ordem_servico_id'; notes='observacoes'; time='horario'; priority='prioridade'; legacy_org_id='organization_id'; appointment_date='data_agendamento'; service_type='tipo_servico'; legacy_client_id='cliente_id'; status='status'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$purchasesJson = Convert-CsvToJson 'docs/base_44_export/Compra_export.csv' ([ordered]@{
  legacy_purchase_id='id'; items='itens'; invoice_number='numero_nota_fiscal'; due_date='data_vencimento'; legacy_financial_transaction_id='lancamento_financeiro_id'; total_amount='valor_total'; notes='observacoes'; legacy_bank_account_id='conta_bancaria_id'; legacy_supplier_id='fornecedor_id'; legacy_org_id='organization_id'; payment_date='data_pagamento'; payment_status='status_pagamento'; purchase_date='data_compra'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$businessAnalysesJson = Convert-CsvToJson 'docs/base_44_export/Consultoria_export.csv' ([ordered]@{
  legacy_business_analysis_id='id'; analysis_date='data_analise'; financial_analysis='analise_financeira'; legacy_org_id='organization_id'; strengths='pontos_fortes'; base_data='dados_base'; title='titulo'; improvement_areas='areas_melhoria'; executive_summary='resumo_executivo'; growth_strategies='estrategias_crescimento'; business_score='score_negocio'; customer_analysis='analise_clientes'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$purchaseReturnsJson = Convert-CsvToJson 'docs/base_44_export/Devolucao_export.csv' ([ordered]@{
  legacy_purchase_return_id='id'; returned_items='itens_devolvidos'; reason='motivo'; generated_financial_credit='gerou_credito_financeiro'; return_date='data_devolucao'; legacy_purchase_id='compra_id'; legacy_financial_transaction_id='lancamento_financeiro_id'; notes='observacoes'; legacy_bank_account_id='conta_bancaria_id'; legacy_supplier_id='fornecedor_id'; legacy_org_id='organization_id'; total_returned_amount='valor_total_devolvido'; status='status'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$bankStatementsJson = Convert-CsvToJson 'docs/base_44_export/ExtratoContaBancaria_export.csv' ([ordered]@{
  legacy_bank_statement_id='id'; transaction_date='data_movimentacao'; notes='observacoes'; legacy_bank_account_id='conta_bancaria_id'; transaction_type='tipo_movimentacao'; legacy_org_id='organization_id'; amount='valor'; previous_balance='saldo_anterior'; legacy_financial_transaction_id='lancamento_financeiro_id'; description='descricao'; new_balance='saldo_posterior'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})

$template = Get-Content -Raw -Path 'tools/operations_support_seed_template.sql'
$sql = $template.
  Replace('__APPOINTMENTS_JSON__', $appointmentsJson).
  Replace('__PURCHASES_JSON__', $purchasesJson).
  Replace('__BUSINESS_ANALYSES_JSON__', $businessAnalysesJson).
  Replace('__PURCHASE_RETURNS_JSON__', $purchaseReturnsJson).
  Replace('__BANK_STATEMENTS_JSON__', $bankStatementsJson)

$outputPath = Join-Path (Get-Location) 'supabase/seeders/migrate/005_operations_support_seed.sql'
[System.IO.File]::WriteAllText($outputPath, $sql, [System.Text.UTF8Encoding]::new($false))
