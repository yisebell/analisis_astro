"""
Módulo para generar archivos Excel (.xlsx) directamente en memoria (io.BytesIO)
desde Supabase para descarga HTTP segura desde cualquier navegador o dispositivo.
"""
import io
from typing import List, Dict, Any
import openpyxl
from openpyxl.worksheet.table import Table, TableStyleInfo
from core.db import obtener_resultados, normalizar_signo


def _poblar_hoja_individual(ws, resultados: List[Dict[str, Any]], table_display_name: str):
    headers = [
        'Fecha', 'Numero', 'Signo',
        'Digito1', 'Digito2', 'Digito3', 'Digito4',
        'Tres_Primeros', 'Tres_Ultimos',
        'Dos_Primeros', 'Segundo_Tercero', 'Tercero_Cuarto',
        'Calc_Digito1', 'Calc_Digito2', 'Calc_Digito3', 'Calc_Digito4',
        'Distancia1', 'Distancia2', 'Distancia3', 'Distancia4',
        'DistanciasBase10', 'Tres_Primeros_DB10', 'Tres_Ultimos_DB10',
        'Dos_Primeros_DB10', 'Segundo_Tercero_DB10', 'Tercero_Cuarto_DB10'
    ]
    ws.append(headers)

    processed_data = []
    for r in resultados:
        numero = str(r['numero']).zfill(4)
        signo = normalizar_signo(r.get('signo', ''))
        digitos = [int(numero[0]), int(numero[1]), int(numero[2]), int(numero[3])]
        row_data = [
            r['fecha'], numero, signo,
            digitos[0], digitos[1], digitos[2], digitos[3],
            numero[0:3], numero[1:4],
            numero[0:2], numero[1:3], numero[2:4]
        ]
        processed_data.append((row_data, digitos))

    calc_results = []
    for i in range(len(processed_data) - 1):
        curr_d = processed_data[i][1]
        next_d = processed_data[i + 1][1]
        row_calcs = []

        for j in range(4):
            if curr_d[j] >= next_d[j]:
                row_calcs.append(curr_d[j] - next_d[j])
            else:
                row_calcs.append(abs((next_d[j] - 10) - curr_d[j]))

        for j in range(4):
            diff = abs(curr_d[j] - next_d[j])
            row_calcs.append(min(diff, 10 - diff))

        db10 = "".join(str(row_calcs[k]) for k in range(4))
        row_calcs.extend([db10, db10[0:3], db10[1:4], db10[0:2], db10[1:3], db10[2:4]])
        calc_results.append(row_calcs)

    if processed_data:
        calc_results.append([''] * 14)

    for idx, (row_data, _) in enumerate(processed_data):
        ws.append(row_data + calc_results[idx])

    if ws.max_row >= 2:
        table = Table(displayName=table_display_name, ref=f"A1:Z{ws.max_row}")
        table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium9", showRowStripes=True)
        ws.add_table(table)


def _poblar_hoja_combinada(ws, resultados: List[Dict[str, Any]], table_display_name: str):
    headers = [
        'Fecha', 'Loteria', 'Numero', 'Signo',
        'Digito1', 'Digito2', 'Digito3', 'Digito4',
        'Tres_Primeros', 'Tres_Ultimos',
        'Dos_Primeros', 'Segundo_Tercero', 'Tercero_Cuarto',
        'Calc_Digito1', 'Calc_Digito2', 'Calc_Digito3', 'Calc_Digito4',
        'Distancia1', 'Distancia2', 'Distancia3', 'Distancia4',
        'DistanciasBase10', 'Tres_Primeros_DB10', 'Tres_Ultimos_DB10',
        'Dos_Primeros_DB10', 'Segundo_Tercero_DB10', 'Tercero_Cuarto_DB10'
    ]
    ws.append(headers)

    processed_data = []
    for r in resultados:
        numero = str(r['numero']).zfill(4)
        signo = normalizar_signo(r.get('signo', ''))
        digitos = [int(numero[0]), int(numero[1]), int(numero[2]), int(numero[3])]
        row_data = [
            r['fecha'], r.get('loteria', ''), numero, signo,
            digitos[0], digitos[1], digitos[2], digitos[3],
            numero[0:3], numero[1:4],
            numero[0:2], numero[1:3], numero[2:4]
        ]
        processed_data.append((row_data, digitos))

    calc_results = [None] * len(processed_data)
    for i in range(len(processed_data)):
        current_lot = processed_data[i][0][1]
        curr_d = processed_data[i][1]

        next_d = None
        for k in range(i + 1, len(processed_data)):
            if processed_data[k][0][1] == current_lot:
                next_d = processed_data[k][1]
                break

        if next_d is None:
            calc_results[i] = [''] * 14
            continue

        row_calcs = []
        for j in range(4):
            if curr_d[j] >= next_d[j]:
                row_calcs.append(curr_d[j] - next_d[j])
            else:
                row_calcs.append(abs((next_d[j] - 10) - curr_d[j]))

        for j in range(4):
            diff = abs(curr_d[j] - next_d[j])
            row_calcs.append(min(diff, 10 - diff))

        db10 = "".join(str(row_calcs[k]) for k in range(4))
        row_calcs.extend([db10, db10[0:3], db10[1:4], db10[0:2], db10[1:3], db10[2:4]])
        calc_results[i] = row_calcs

    for idx, (row_data, _) in enumerate(processed_data):
        ws.append(row_data + calc_results[idx])

    if ws.max_row >= 2:
        table = Table(displayName=table_display_name, ref=f"A1:AA{ws.max_row}")
        table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium9", showRowStripes=True)
        ws.add_table(table)


def generar_excel_bytes(loteria: str = 'all') -> bytes:
    """
    Genera un libro Excel (.xlsx) en memoria:
    - 'luna': hoja resultados_luna
    - 'sol': hoja resultados_sol
    - 'combinados': hoja resultados_combinados
    - 'all': libro completo con las 3 hojas (Luna, Sol y Combinados)
    """
    lot = (loteria or 'all').lower()
    wb = openpyxl.Workbook()
    default_sheet = wb.active

    if lot in ('luna', 'all'):
        ws_luna = wb.create_sheet('resultados_luna')
        _poblar_hoja_individual(ws_luna, obtener_resultados('luna'), 'ResultadosLuna')

    if lot in ('sol', 'all'):
        ws_sol = wb.create_sheet('resultados_sol')
        _poblar_hoja_individual(ws_sol, obtener_resultados('sol'), 'ResultadosSol')

    if lot in ('combinados', 'all'):
        ws_comb = wb.create_sheet('resultados_combinados')
        _poblar_hoja_combinada(ws_comb, obtener_resultados('combinados'), 'ResultadosTotales')

    if len(wb.sheetnames) > 1 and default_sheet in wb.worksheets:
        wb.remove(default_sheet)

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
