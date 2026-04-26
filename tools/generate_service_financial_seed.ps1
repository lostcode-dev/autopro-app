$ErrorActionPreference = 'Stop'

$maxChunkBytes = 650KB

function Convert-CsvToRows($path, $map) {
  return @(Import-Csv -Path $path | ForEach-Object {
    $o = [ordered]@{}
    foreach ($entry in $map.GetEnumerator()) {
      $o[$entry.Key] = [string]($_.($entry.Value))
    }
    [pscustomobject]$o
  })
}

function Convert-RowsToJson($rows) {
  return (ConvertTo-Json -InputObject @($rows) -Compress -Depth 30)
}

function Split-RowsByJsonSize($rows, $maxBytes) {
  $chunks = New-Object System.Collections.Generic.List[object]
  $current = New-Object System.Collections.Generic.List[object]
  $currentBytes = 2

  foreach ($row in $rows) {
    $rowJson = ConvertTo-Json -InputObject $row -Compress -Depth 30
    $rowBytes = [System.Text.Encoding]::UTF8.GetByteCount($rowJson) + 1

    if ($current.Count -gt 0 -and ($currentBytes + $rowBytes) -gt $maxBytes) {
      $chunks.Add(@($current.ToArray()))
      $current = New-Object System.Collections.Generic.List[object]
      $currentBytes = 2
    }

    $current.Add($row)
    $currentBytes += $rowBytes
  }

  if ($current.Count -gt 0) {
    $chunks.Add(@($current.ToArray()))
  }

  return ,$chunks
}

function Get-Block($text, $startMarker, $endMarker) {
  $start = $text.IndexOf($startMarker)
  $end = $text.IndexOf($endMarker, $start)

  if ($start -lt 0 -or $end -lt 0) {
    throw "Could not locate block markers: $startMarker -> $endMarker"
  }

  return $text.Substring($start, $end - $start)
}

function New-SeederSql($fileName, $description, $tempBlock, $insertBlock, $noticeBlock, $placeholder, [object[]]$rows) {
  $json = Convert-RowsToJson $rows
  $tempBlockWithRows = $tempBlock.Replace($placeholder, $json)

  return @"
-- =============================================================================
-- Seeder: $fileName
-- Description: $description
-- =============================================================================

DO `$`$
DECLARE
  v_namespace uuid := '0f0f8ef0-8db5-4d52-a4ec-9cfdd0b451b1';
BEGIN
$tempBlockWithRows
$insertBlock
$noticeBlock
END `$`$;
"@
}

function Write-Seeders($prefix, $description, $rows, $tempBlock, $insertBlock, $noticeBlock, $placeholder) {
  $outputDir = Join-Path (Get-Location) 'supabase/seeders/migrate'
  $chunks = Split-RowsByJsonSize $rows $maxChunkBytes

  for ($i = 0; $i -lt $chunks.Count; $i++) {
    $part = ($i + 1).ToString('00')
    $fileName = if ($chunks.Count -eq 1) {
      "$prefix`_seed.sql"
    } else {
      "$prefix`_part_$part`_seed.sql"
    }
    $sql = New-SeederSql $fileName $description $tempBlock $insertBlock $noticeBlock $placeholder -rows ([object[]]$chunks[$i])
    $outputPath = Join-Path $outputDir $fileName
    [System.IO.File]::WriteAllText($outputPath, $sql, [System.Text.UTF8Encoding]::new($false))
  }
}

$serviceOrderRows = Convert-CsvToRows 'docs/base_44_export/OrdemServico_export.csv' ([ordered]@{
  legacy_service_order_id='id'; legacy_org_id='organization_id'; legacy_vehicle_id='veiculo_id'; legacy_number='numero'; discount='desconto'; expected_payment_date='data_prevista_pagamento'; apply_taxes='aplicar_impostos'; active_nfse_id='nfse_active_id'; responsible_employees='responsaveis'; commission_amount='valor_comissao'; terminal_fee_amount='valor_taxa_maquininha'; reported_defect='defeito_relatado'; payment_method='forma_pagamento'; nfe_ids='nfe_ids'; expected_date='data_prevista'; items='itens'; active_nfe_id='nfe_active_id'; total_cost_amount='valor_custo_total'; selected_taxes='impostos_selecionados'; total_taxes_amount='valor_impostos_total'; completion_date='data_conclusao'; legacy_appointment_id='agendamento_id'; total_amount='valor_total'; entry_date='data_entrada'; notes='observacoes'; nfse_ids='nfse_ids'; diagnosis='diagnostico'; legacy_employee_responsible_id='funcionario_responsavel_id'; is_installment='parcelado'; payment_status='status_pagamento'; installment_count='numero_parcelas'; legacy_client_id='cliente_id'; legacy_master_product_id='produto_master_id'; status='status'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$logRows = Convert-CsvToRows 'docs/base_44_export/OSEditLog_export.csv' ([ordered]@{
  legacy_log_id='id'; legacy_service_order_id='ordem_servico_id'; user_name='usuario_nome'; notes='observacao'; data_after='dados_depois'; legacy_org_id='organization_id'; operation_type='tipo_operacao'; data_before='dados_antes'; legacy_correction_id='correcao_id'; service_order_number='numero_os'; user_email='usuario_email'; changed_fields='campos_alterados'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$installmentRows = Convert-CsvToRows 'docs/base_44_export/ParcelaOrdemServico_export.csv' ([ordered]@{
  legacy_installment_id='id'; legacy_service_order_id='ordem_servico_id'; payment_method='forma_pagamento'; notes='observacoes'; installment_number='numero_parcela'; legacy_org_id='organization_id'; payment_date='data_pagamento'; installment_amount='valor_parcela'; due_date='data_vencimento'; status='status'; legacy_financial_transaction_id='lancamento_financeiro_id'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$employeeRecordRows = Convert-CsvToRows 'docs/base_44_export/RegistroFinanceiroFuncionario_export.csv' ([ordered]@{
  legacy_employee_financial_record_id='id'; legacy_service_order_id='ordem_servico_id'; legacy_installment_id='parcela_ordem_servico_id'; legacy_org_id='organization_id'; amount='valor'; payment_date='data_pagamento'; legacy_employee_id='funcionario_id'; record_type='tipo_registro'; description='descricao'; reference_date='data_referencia'; status='status'; legacy_financial_transaction_id='lancamento_financeiro_id'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})
$financialRows = Convert-CsvToRows 'docs/base_44_export/LancamentoFinanceiro_export.csv' ([ordered]@{
  legacy_financial_transaction_id='id'; legacy_installment_id='parcela_ordem_servico_id'; type='tipo'; current_installment='parcela_atual'; legacy_employee_financial_record_id='registro_funcionario_id'; category='categoria'; amount='valor'; due_date='data_vencimento'; description='descricao'; recurrence='recorrencia'; legacy_purchase_id='compra_id'; notes='observacoes'; legacy_parent_transaction_id='id_lancamento_pai'; legacy_bank_account_id='conta_bancaria_id'; legacy_parent_recurrence_id='id_lancamento_recorrente_pai'; legacy_org_id='organization_id'; is_installment='parcelado'; recurrence_end_date='data_encerramento_recorrencia'; installment_count='numero_parcelas'; status='status'; created_at='created_date'; updated_at='updated_date'; created_by='created_by'
})

$template = Get-Content -Raw -Path 'tools/service_financial_seed_template.sql'

$serviceOrderTemp = Get-Block $template '  CREATE TEMP TABLE tmp_service_order_source' '  CREATE TEMP TABLE tmp_service_order_installment_source'
$installmentTemp = Get-Block $template '  CREATE TEMP TABLE tmp_service_order_installment_source' '  CREATE TEMP TABLE tmp_employee_financial_record_source'
$employeeTemp = Get-Block $template '  CREATE TEMP TABLE tmp_employee_financial_record_source' '  CREATE TEMP TABLE tmp_financial_transaction_source'
$financialTemp = Get-Block $template '  CREATE TEMP TABLE tmp_financial_transaction_source' '  CREATE TEMP TABLE tmp_service_order_edit_log_source'
$logTemp = Get-Block $template '  CREATE TEMP TABLE tmp_service_order_edit_log_source' '  INSERT INTO public.service_orders'

$serviceOrderInsert = Get-Block $template '  INSERT INTO public.service_orders' '  INSERT INTO public.service_order_installments'
$installmentInsert = Get-Block $template '  INSERT INTO public.service_order_installments' '  INSERT INTO public.employee_financial_records'
$employeeInsert = Get-Block $template '  INSERT INTO public.employee_financial_records' '  INSERT INTO public.financial_transactions'
$financialInsert = Get-Block $template '  INSERT INTO public.financial_transactions' '  INSERT INTO public.service_order_edit_logs'
$logInsert = Get-Block $template '  INSERT INTO public.service_order_edit_logs' "  RAISE NOTICE 'Skipped % service orders"

$serviceOrderNotice = Get-Block $template "  RAISE NOTICE 'Skipped % service orders" "  RAISE NOTICE 'Skipped % service order installments"
$installmentNotice = Get-Block $template "  RAISE NOTICE 'Skipped % service order installments" "  RAISE NOTICE 'Skipped % employee financial records"
$employeeNotice = Get-Block $template "  RAISE NOTICE 'Skipped % employee financial records" "  RAISE NOTICE 'Skipped % financial transactions"
$financialNotice = Get-Block $template "  RAISE NOTICE 'Skipped % financial transactions" "  RAISE NOTICE 'Skipped % service order edit logs"
$logNotice = Get-Block $template "  RAISE NOTICE 'Skipped % service order edit logs" 'END $$;'

$outputDir = Join-Path (Get-Location) 'supabase/seeders/migrate'
Get-ChildItem -Path $outputDir -Filter '006_service_*_seed.sql' | Remove-Item
Get-ChildItem -Path $outputDir -Filter '006_service_*_part_*_seed.sql' | Remove-Item
Get-ChildItem -Path $outputDir -Filter '007_service_*_seed.sql' | Remove-Item
Get-ChildItem -Path $outputDir -Filter '007_service_*_part_*_seed.sql' | Remove-Item
Get-ChildItem -Path $outputDir -Filter '008_employee_financial_records*_seed.sql' | Remove-Item
Get-ChildItem -Path $outputDir -Filter '009_financial_transactions*_seed.sql' | Remove-Item
Get-ChildItem -Path $outputDir -Filter '010_service_order_edit_logs*_seed.sql' | Remove-Item
Get-ChildItem -Path $outputDir -Filter '006_service_financial_seed.sql' | Remove-Item -ErrorAction SilentlyContinue
Get-ChildItem -Path $outputDir -Filter '006_service_financial_core_seed.sql' | Remove-Item -ErrorAction SilentlyContinue
Get-ChildItem -Path $outputDir -Filter '007_service_order_edit_logs_seed.sql' | Remove-Item -ErrorAction SilentlyContinue

Write-Seeders '006_service_orders' 'Migrates service orders from Base44 exports after identity, catalog, and master-product seeds.' $serviceOrderRows $serviceOrderTemp $serviceOrderInsert $serviceOrderNotice '__SERVICE_ORDERS_JSON__'
Write-Seeders '007_service_order_installments' 'Migrates service order installments from Base44 exports after service orders exist.' $installmentRows $installmentTemp $installmentInsert $installmentNotice '__INSTALLMENTS_JSON__'
Write-Seeders '008_employee_financial_records' 'Migrates employee financial records from Base44 exports after service orders and installments exist.' $employeeRecordRows $employeeTemp $employeeInsert $employeeNotice '__EMPLOYEE_FINANCIAL_RECORDS_JSON__'
Write-Seeders '009_financial_transactions' 'Migrates financial transactions from Base44 exports after operations, purchases, installments, and employee records exist.' $financialRows $financialTemp $financialInsert $financialNotice '__FINANCIAL_TRANSACTIONS_JSON__'
Write-Seeders '010_service_order_edit_logs' 'Migrates service order edit logs from Base44 exports after service orders exist.' $logRows $logTemp $logInsert $logNotice '__SERVICE_ORDER_EDIT_LOGS_JSON__'
