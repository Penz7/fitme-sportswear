import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

const DEFAULT_BANK_BIN = '970418'; // BIDV
const DEFAULT_BANK_NAME = 'BIDV';
const DEFAULT_ACCOUNT_NUMBER = '8619971990';
const DEFAULT_ACCOUNT_HOLDER = 'CONG TY TNHH SAN XUAT MAY MAC HAVA';
const DEFAULT_HEADING = 'Thanh toán chuyển khoản';
const ORDER_REFERENCE_API = 'https://api.fitme.vn/public/checkout-orders/reference';

export default async () => {
  render(<TransferQrInstructions />, document.body);
};

function TransferQrInstructions() {
  const bankBin = setting('bank_bin', DEFAULT_BANK_BIN).replace(/\s/g, '');
  const bankName = setting('bank_name', DEFAULT_BANK_NAME);
  const accountNumber = setting('account_number', DEFAULT_ACCOUNT_NUMBER);
  const accountHolder = setting('account_holder', DEFAULT_ACCOUNT_HOLDER);
  const heading = setting('heading', DEFAULT_HEADING);
  const additionalInstructions = setting('additional_instructions', '');
  const selectedPaymentOptions = shopify.selectedPaymentOptions.value ?? [];
  const transferWasSelected = selectedPaymentOptions.some(
    (paymentOption) => paymentOption.type === 'manualPayment',
  );
  const showForTestPayment =
    shopify.settings.value.show_qr_for_test_payment === true;
  const orderId = shopify.orderConfirmation.value?.order?.id
    ?.split('/')
    .pop();
  const checkoutToken = shopify.checkoutToken.value;
  const [reference, setReference] = useState(null);
  const [referenceError, setReferenceError] = useState(false);

  useEffect(() => {
    if (!transferWasSelected && !showForTestPayment) return;
    if (!orderId || !checkoutToken) return;

    const request = new URL(ORDER_REFERENCE_API);
    request.searchParams.set('orderId', orderId);
    request.searchParams.set('checkoutToken', checkoutToken);

    fetch(request)
      .then((response) => {
        if (!response.ok) throw new Error('Order reference request failed');
        return response.json();
      })
      .then((payload) => {
        if (typeof payload.reference !== 'string' || !payload.reference.trim()) {
          throw new Error('Order reference missing from response');
        }
        setReference(payload.reference);
      })
      .catch(() => setReferenceError(true));
  }, [checkoutToken, orderId, showForTestPayment, transferWasSelected]);

  // COD uses paymentOnDelivery, so it must never receive bank instructions.
  // The setting is off by default and exists only for development-store testing
  // with Shopify's Bogus Gateway, which cannot simulate manual payments.
  if (!transferWasSelected && !showForTestPayment) return null;

  if (!reference) {
    return (
      <s-section heading={heading}>
        <s-banner tone={referenceError ? 'critical' : 'info'}>
          {referenceError
            ? 'Không thể tạo mã chuyển khoản cho đơn hàng này. Vui lòng liên hệ Fitme để được hỗ trợ.'
            : 'Đang tạo thông tin chuyển khoản cho đơn hàng của bạn...'}
        </s-banner>
      </s-section>
    );
  }

  const total = shopify.cost.totalAmount.value;
  const amount = Math.round(Number(total.amount));
  const qrImageUrl = createVietQrImageUrl({
    bankBin,
    accountNumber,
    accountHolder,
    amount,
    reference,
  });
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount);

  return (
    <s-section heading={heading}>
      <s-stack gap="base" blockAlignment="center">
        <s-text>
          Quét mã QR để chuyển khoản đúng số tiền cho đơn hàng này. Nội dung
          chuyển khoản: {reference}.
        </s-text>
        <s-image
          src={qrImageUrl}
          alt={`Mã VietQR ${bankName}, số tiền ${formattedAmount} đồng, nội dung ${reference}`}
          inlineSize="260px"
        />
        <s-text type="strong">Số tiền: {formattedAmount} ₫</s-text>
        <s-text>Ngân hàng: {bankName}</s-text>
        <s-text>Số tài khoản: {accountNumber}</s-text>
        <s-text>Chủ tài khoản: {accountHolder}</s-text>
        {additionalInstructions ? <s-text>{additionalInstructions}</s-text> : null}
        <s-banner tone="info">
          <s-stack gap="small">
            <s-text type="strong">Đơn hàng đang chờ thanh toán</s-text>
            <s-text>
              Sau khi Fitme nhận được khoản chuyển, chúng tôi sẽ xác nhận
              thanh toán và tiến hành xử lý đơn hàng của anh/chị.
            </s-text>
            <s-text>
              Vui lòng hoàn tất thanh toán trong vòng 30 phút kể từ khi đặt
              hàng. Nếu quá thời hạn mà Fitme chưa nhận được thanh toán, đơn
              hàng sẽ tự động bị hủy.
            </s-text>
          </s-stack>
        </s-banner>
        <s-stack gap="small" blockAlignment="center">
          <s-text type="strong">Liên hệ hỗ trợ</s-text>
          <s-text>
            Nếu cần hỗ trợ về thông tin đơn hàng hoặc chuyển khoản, anh/chị
            hãy nhắn ngay cho Fitme. Đội ngũ Fitme luôn sẵn sàng hỗ trợ.
          </s-text>
          <s-button
            href="https://www.facebook.com/fitme.vn?locale=vi_VN"
            target="_blank"
            variant="secondary"
          >
            Liên hệ Fitme qua Facebook
          </s-button>
        </s-stack>
        {showForTestPayment && !transferWasSelected ? (
          <s-banner tone="warning">
            Chế độ kiểm thử đang bật. Chỉ dùng để kiểm tra giao diện QR với
            Bogus Gateway; phải tắt trước khi cài ở shop thật.
          </s-banner>
        ) : null}
      </s-stack>
    </s-section>
  );
}

function setting(key, fallback) {
  const value = shopify.settings.value[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function createVietQrImageUrl({
  bankBin,
  accountNumber,
  accountHolder,
  amount,
  reference,
}) {
  const parameters = new URLSearchParams({
    amount: String(amount),
    addInfo: reference,
    accountName: accountHolder,
  });

  return `https://img.vietqr.io/image/${bankBin}-${accountNumber.replace(/\s/g, '')}-compact2.png?${parameters}`;
}
