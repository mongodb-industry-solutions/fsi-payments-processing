import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

// Format metadata with characteristics
const formatMetadata = {
  // Source formats
  MT103: {
    name: "Wire Transfer",
    standard: "SWIFT MT",
    type: "source",
    fields: 15,
    characteristics: ["Bank-to-Bank", "International", "Tagged Format"],
    mongoCollection: "source_formats",
    icon: "🏦",
    description: "Customer credit transfer for international wire payments"
  },
  MT202: {
    name: "Bank-to-Bank Transfer",
    standard: "SWIFT MT",
    type: "source",
    fields: 10,
    characteristics: ["Financial Institution", "Cover Payment", "Tagged Format"],
    mongoCollection: "source_formats",
    icon: "🏛️",
    description: "General financial institution transfer between banks"
  },
  MT900: {
    name: "Confirmation of Debit",
    standard: "SWIFT MT",
    type: "source",
    fields: 6,
    characteristics: ["Debit Confirmation", "Account Statement", "Tagged Format"],
    mongoCollection: "source_formats",
    icon: "📝",
    description: "Confirmation of debit to account servicing institution"
  },
  SWIFT_MT: {
    name: "Generic SWIFT Message",
    standard: "SWIFT MT",
    type: "source",
    fields: 8,
    characteristics: ["Generic Format", "Flexible", "Tagged Format"],
    mongoCollection: "source_formats",
    icon: "📨",
    description: "Generic SWIFT message format for various payment types"
  },
  
  // Target formats
  "pacs.008": {
    name: "Credit Transfer",
    standard: "ISO 20022",
    type: "target",
    fields: 25,
    characteristics: ["XML Format", "Structured", "Modern Standard"],
    mongoCollection: "target_formats",
    icon: "📄",
    description: "ISO 20022 customer credit transfer initiation"
  },
  "pacs.004": {
    name: "Payment Return",
    standard: "ISO 20022",
    type: "target",
    fields: 20,
    characteristics: ["XML Format", "Return/Reversal", "Structured"],
    mongoCollection: "target_formats",
    icon: "↩️",
    description: "ISO 20022 payment return message"
  },
  ISO8583: {
    name: "Card Payment",
    standard: "ISO 8583",
    type: "target",
    fields: 30,
    characteristics: ["Binary/ASCII", "Card Networks", "Real-time"],
    mongoCollection: "target_formats",
    icon: "💳",
    description: "Standard for card payment transactions"
  },
  crypto: {
    name: "Stablecoin API",
    standard: "Blockchain",
    type: "target",
    fields: 12,
    characteristics: ["JSON Format", "Blockchain", "Digital Assets"],
    mongoCollection: "target_formats",
    icon: "🪙",
    description: "Cryptocurrency/stablecoin transfer format"
  }
};

// Fallback sample data for source formats (used if backend is unavailable)
const sourceSamples = {
  MT103: `{1:F01BANKUSAAAXXX0000000000}{2:I103BANKUSBBXXXXN}{3:{108:1234567890123456}}{4:
:20:CORP-2024-11-3847
:23B:CRED
:32A:241106USD50000,00
:50K:/1234567890
TECH INNOVATIONS INC.
123 SILICON VALLEY WAY
SAN FRANCISCO, CA 94105
:59:/0987654321
GLOBAL SUPPLIERS LTD.
456 COMMERCE STREET
NEW YORK, NY 10013
:70:PAYMENT FOR INVOICE INV-2024-11-3847
:71A:OUR
-}`,
  
  MT202: `:20:REF456
:21:RELATED789
:32A:240315USD100000,00
:52A:BANKUSAA
:53A:BANKUSBB
:54A:BANKUSCC
:56A:BANKUSDD
:57A:BANKUSEE
:58A:BANKUSFF
:72:/INS/URGENT PAYMENT`,
  
  MT900: `:20:DEBIT789
:21:REFERENCE456
:25:1234567890
:32A:240315USD25000,00
:52A:BANKUSAA
:72:CONFIRMATION OF DEBIT`,
  
  SWIFT_MT: `:20:GENERIC001
:23B:CRED
:32A:240315EUR75000,00
:50:ORDERING CUSTOMER
:59:BENEFICIARY CUSTOMER
:70:PAYMENT DETAILS
:71A:SHA`,
  
  ISO8583: `0200B23A800128C180020000000000000000161234567890123456120150120150120111300000001000012345612345606051105511092700`
};

// Template previews for target formats
const targetTemplates = {
  "pacs.008": `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>{Message ID}</MsgId>
      <CreDtTm>{Creation DateTime}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>INDA</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>{Instruction ID}</InstrId>
        <EndToEndId>{End-to-End ID}</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="{Currency}">{Amount}</IntrBkSttlmAmt>
      <Dbtr>
        <Nm>{Debtor Name}</Nm>
        <PstlAdr>
          <AdrLine>{Address}</AdrLine>
        </PstlAdr>
      </Dbtr>
      <Cdtr>
        <Nm>{Creditor Name}</Nm>
      </Cdtr>
      <RmtInf>
        <Ustrd>{Remittance Info}</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,

  "pacs.004": `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09">
  <PmtRtr>
    <GrpHdr>
      <MsgId>{Message ID}</MsgId>
      <CreDtTm>{Creation DateTime}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <TxInf>
      <RtrId>{Return ID}</RtrId>
      <OrgnlGrpInf>
        <OrgnlMsgId>{Original Message ID}</OrgnlMsgId>
        <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
      </OrgnlGrpInf>
      <RtrRsnInf>
        <Rsn>
          <Cd>{Return Reason Code}</Cd>
        </Rsn>
      </RtrRsnInf>
      <RtrdIntrBkSttlmAmt Ccy="{Currency}">{Amount}</RtrdIntrBkSttlmAmt>
    </TxInf>
  </PmtRtr>
</Document>`,

  ISO8583: `{
  "MTI": "0200",
  "Fields": {
    "2": "{Primary Account Number}",
    "3": "000000",
    "4": "{Transaction Amount}",
    "7": "{Transmission DateTime}",
    "11": "{System Trace Audit Number}",
    "12": "{Local Transaction Time}",
    "13": "{Local Transaction Date}",
    "32": "{Acquiring Institution ID}",
    "37": "{Retrieval Reference Number}",
    "41": "{Card Acceptor Terminal ID}",
    "42": "{Card Acceptor ID}",
    "43": "{Card Acceptor Name/Location}",
    "49": "{Transaction Currency Code}",
    "60": "{Reserved Private}"
  }
}`,

  crypto: `{
  "type": "stablecoin_transfer",
  "network": "ethereum",
  "from": {
    "address": "{Sender Wallet Address}",
    "name": "{Sender Name}"
  },
  "to": {
    "address": "{Recipient Wallet Address}",
    "name": "{Recipient Name}"
  },
  "amount": "{Amount}",
  "currency": "USDC",
  "gas": {
    "limit": "{Gas Limit}",
    "price": "{Gas Price}"
  },
  "memo": "{Payment Reference}",
  "timestamp": "{ISO 8601 Timestamp}"
}`
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const type = searchParams.get("type"); // 'source' or 'target'
  
  // If no format specified, return all metadata
  if (!format) {
    return NextResponse.json({
      success: true,
      formats: formatMetadata
    });
  }
  
  // Get specific format preview
  const metadata = formatMetadata[format];
  if (!metadata) {
    return NextResponse.json(
      { success: false, error: "Format not found" },
      { status: 404 }
    );
  }
  
  // Try to fetch sample from backend MongoDB
  let preview = "";
  let sampleInfo = null;
  let isFromMongoDB = false;
  
  try {
    // Fetch sample from backend API
    const sampleResponse = await fetch(`${BACKEND_API_URL}/api/v1/samples/preview/${format}`);
    
    if (sampleResponse.ok) {
      const sampleData = await sampleResponse.json();
      if (sampleData.success && sampleData.preview) {
        preview = sampleData.preview;
        sampleInfo = {
          sample_name: sampleData.sample_name,
          has_free_text: sampleData.has_free_text,
          free_text_fields: sampleData.free_text_fields,
          is_template: sampleData.is_template
        };
        isFromMongoDB = !sampleData.is_template;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch sample from backend for ${format}:`, error);
  }
  
  // Fallback to hardcoded samples if backend fetch failed
  if (!preview) {
    if (metadata.type === "source" || type === "source") {
      preview = sourceSamples[format] || "";
    } else {
      preview = targetTemplates[format] || "";
    }
  }
  
  return NextResponse.json({
    success: true,
    format: format,
    metadata: metadata,
    preview: preview,
    sampleInfo: sampleInfo,
    mongoInfo: {
      collection: metadata.mongoCollection,
      fromMongoDB: isFromMongoDB,
      message: isFromMongoDB 
        ? `Sample dynamically loaded from MongoDB ${metadata.mongoCollection} collection`
        : `Using fallback template (MongoDB sample not available)`
    }
  });
}