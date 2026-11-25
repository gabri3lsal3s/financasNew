import { describe, expect, it } from "vitest";
import { extractOfxMetadata, parseOfxToTransactions } from "./ofx-extractor";

describe("ofx-parser — Blindagem Monetária, Polaridade e Metadados (Itens #17, #18 e #19)", () => {
  it("interpreta -1.234,56 sem erro 1000x via parseAmountToCents (#17)", () => {
    const ofx = `
OFXHEADER:100
<OFX>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <CCSTMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261110120000[-3:BRT]
            <TRNAMT>-1.234,56
            <FITID>TX-001
            <MEMO>COMPRA LOJA GRANDE
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261112120000[-3:BRT]
            <TRNAMT>-89.90
            <FITID>TX-002
            <MEMO>FARMACIA CENTRAL
          </STMTTRN>
        </BANKTRANLIST>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`;

    const txs = parseOfxToTransactions(ofx, {
      cardId: "card-1",
      competenceMonth: "2026-11",
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]?.amountCents).toBe(123456);
    expect(txs[0]?.isRefund).toBe(false);
    expect(txs[0]?.isPayment).toBe(false);
    expect(txs[1]?.amountCents).toBe(8990);
    expect(txs[1]?.isRefund).toBe(false);
  });

  it("infere polaridade automaticamente quando TRNTYPE=OTHER usa compras positivas e pagamento negativo (#18)", () => {
    const ofx = `
<OFX>
  <BANKTRANLIST>
    <STMTTRN>
      <TRNTYPE>OTHER
      <DTPOSTED>20261102
      <TRNAMT>-1500.00
      <MEMO>PAGAMENTO FATURA RECEBIDO
    </STMTTRN>
    <STMTTRN>
      <TRNTYPE>OTHER
      <DTPOSTED>20261105
      <TRNAMT>120.50
      <MEMO>SUPERMERCADO ZONA SUL
    </STMTTRN>
    <STMTTRN>
      <TRNTYPE>OTHER
      <DTPOSTED>20261108
      <TRNAMT>49.90
      <MEMO>UBER TRIP
    </STMTTRN>
    <STMTTRN>
      <TRNTYPE>OTHER
      <DTPOSTED>20261109
      <TRNAMT>-35.00
      <MEMO>ESTORNO COMPRA CANCELADA
    </STMTTRN>
  </BANKTRANLIST>
</OFX>`;

    const txs = parseOfxToTransactions(ofx, {
      cardId: "card-1",
      competenceMonth: "2026-11",
    });

    expect(txs).toHaveLength(4);
    expect(txs[0]?.isPayment).toBe(true);
    expect(txs[0]?.isRefund).toBe(false);

    expect(txs[1]?.cleanDescription).toMatch(/Supermercado Zona Sul/i);
    expect(txs[1]?.isRefund).toBe(false);
    expect(txs[1]?.isPayment).toBe(false);

    expect(txs[2]?.isRefund).toBe(false);
    expect(txs[2]?.isPayment).toBe(false);

    expect(txs[3]?.isRefund).toBe(true);
    expect(txs[3]?.isPayment).toBe(false);
  });

  it("descarta SALDO ANTERIOR e extrai metadados informativos <ORG>, <ACCTID> e <LEDGERBAL> (#19)", () => {
    const ofx = `
OFXHEADER:100
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <FI>
        <ORG>Nubank Brasil
      </FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <CCSTMTRS>
        <CCACCTFROM>
          <ACCTID>5162999900002107
        </CCACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261101
            <TRNAMT>-800.00
            <MEMO>SALDO ANTERIOR
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261110
            <TRNAMT>-55.00
            <MEMO>PADARIA ESTRELA
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>-1.528,54
          <DTASOF>20261115
        </LEDGERBAL>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`;

    const txs = parseOfxToTransactions(ofx, {
      cardId: "card-1",
      competenceMonth: "2026-11",
    });
    expect(txs).toHaveLength(1);
    expect(txs[0]?.cleanDescription).toMatch(/Padaria Estrela/i);

    const meta = extractOfxMetadata(ofx);
    expect(meta.org).toBe("Nubank Brasil");
    expect(meta.acctId).toBe("5162999900002107");
    expect(meta.acctLast4).toBe("2107");
    expect(meta.ledgerBalanceCents).toBe(152854);
  });
});
