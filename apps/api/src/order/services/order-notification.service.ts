import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EmailServiceUtils } from 'src/common/utils/email-service.utils';
import { SmsServiceUtils } from 'src/common/utils/sms-service.utils';
import { WhatsappMessageService } from 'src/whatsapp/services/whatsapp-message.service';
import { User } from 'src/user/entities/user.entity';
import { Order } from '../entities/order.entity';
import { OrderShippingAddress } from '../entities/order-shipping-address.entity';
import { normalizeProfilePreferences } from 'src/user/profile-preferences';

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrderShippingAddress)
    private readonly shippingAddressRepo: Repository<OrderShippingAddress>,
    private readonly emailService: EmailServiceUtils,
    private readonly smsService: SmsServiceUtils,
    private readonly whatsappService: WhatsappMessageService,
    private readonly configService: ConfigService,
  ) {}

  private getAppName(): string {
    return this.configService.get<string>('APP_NAME') || 'Store';
  }

  private formatAmount(amount: string | number, currency: string): string {
    const v = Number(amount || 0);
    if (!Number.isFinite(v)) return `${currency} 0.00`;
    return `${currency} ${v.toFixed(2)}`;
  }

  private async resolveContact(order: Order) {
    const user = order.customerId
      ? await this.userRepo.findOne({ where: { id: order.customerId } })
      : null;

    const prefs = user ? normalizeProfilePreferences(user.profilePreferences) : null;

    const allowEmail = prefs
      ? !!prefs.notifications.email.enabled && !!prefs.notifications.email.orderUpdates
      : true;
    const allowSms = prefs
      ? !!prefs.notifications.sms.enabled && !!prefs.notifications.sms.orderUpdates
      : true;

    const shippingAddress = await this.shippingAddressRepo.findOne({
      where: { orderId: order.id },
    });

    const name =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
      order.customerName ||
      'Customer';

    const email = order.customerEmail || user?.email || '';
    const phone = shippingAddress?.phone || (user as any)?.phone || '';

    return {
      user,
      name,
      email,
      phone,
      allowEmail,
      allowSms,
    };
  }

  async sendInvoiceReady(input: {
    order: Order;
    invoiceUrl: string;
    paymentUrl: string;
    pdfUrl: string;
  }): Promise<void> {
    const { order, invoiceUrl, paymentUrl, pdfUrl } = input;
    const contact = await this.resolveContact(order);
    const appName = this.getAppName();

    const amount = this.formatAmount(order.grandTotal, order.currencyCode);

    if (contact.allowEmail && contact.email) {
      try {
        await this.emailService.sendOrderInvoiceEmail({
          email: contact.email,
          customerName: contact.name,
          orderNumber: order.orderNumber,
          amount: amount.replace(`${order.currencyCode} `, ''),
          currency: order.currencyCode,
          invoiceUrl,
          paymentUrl,
          pdfUrl,
          appName,
        });
      } catch (err) {
        this.logger.warn(`Email invoice failed for order ${order.id}`);
      }
    }

    if (contact.allowSms && contact.phone) {
      try {
        await this.smsService.sendSms({
          to: contact.phone,
          message: `Invoice for ${order.orderNumber} ready. Amount: ${amount}. Pay: ${paymentUrl}. PDF: ${pdfUrl}`,
        });
      } catch (err) {
        this.logger.warn(`SMS invoice failed for order ${order.id}`);
      }
    }

    if (contact.phone) {
      try {
        await this.whatsappService.send({
          to: contact.phone,
          templateName: 'order_invoice_ready',
          language: 'en_US',
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: contact.name || 'Customer' },
                { type: 'text', text: order.orderNumber },
                { type: 'text', text: amount },
                { type: 'text', text: paymentUrl },
                { type: 'text', text: pdfUrl },
              ],
            },
          ],
        });
      } catch (err) {
        this.logger.warn(`WhatsApp invoice failed for order ${order.id}`);
      }
    }
  }
}
