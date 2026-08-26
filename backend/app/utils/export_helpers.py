"""
Shared helpers for tabular report exports (CSV and Excel-compatible).
"""

from __future__ import annotations

import base64
import csv
import io
from typing import Any, List, Sequence, Union

Row = Sequence[Union[str, int, float, None]]


def _escape_tsv(value: Any) -> str:
    return str(value if value is not None else "").replace("\t", " ").replace("\r", " ").replace("\n", " ")


def encode_tabular_export(
    headers: List[str],
    rows: List[Row],
    export_format: str = "csv",
    filename_stem: str = "export",
) -> dict:
    """
    Build a base64-encoded CSV or Excel-compatible (.xls) export payload.
    """
    fmt = (export_format or "csv").lower().strip()
    is_excel = fmt in {"excel", "xlsx", "xls"}

    if is_excel:
        output = io.StringIO()
        output.write("\ufeff")
        output.write("\t".join(_escape_tsv(h) for h in headers) + "\n")
        for row in rows:
            output.write("\t".join(_escape_tsv(cell) for cell in row) + "\n")
        payload = output.getvalue().encode("utf-8")
        return {
            "content": base64.b64encode(payload).decode("utf-8"),
            "filename": f"{filename_stem}.xls",
            "contentType": "application/vnd.ms-excel;charset=utf-8",
        }

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    payload = output.getvalue().encode("utf-8")
    return {
        "content": base64.b64encode(payload).decode("utf-8"),
        "filename": f"{filename_stem}.csv",
        "contentType": "text/csv",
    }
