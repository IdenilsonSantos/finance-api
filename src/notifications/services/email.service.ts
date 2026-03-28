import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly from: string;
  private readonly provider: 'resend' | 'smtp';
  private readonly resend?: Resend;
  private readonly transporter?: nodemailer.Transporter;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow('EMAIL_FROM');

    const resendKey = config.get<string>('RESEND_API_KEY');
    const smtpHost = config.get<string>('SMTP_HOST');

    if (smtpHost) {
      this.provider = 'smtp';
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: config.get<number>('SMTP_PORT') ?? 587,
        secure: config.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: config.getOrThrow('SMTP_USER'),
          pass: config.getOrThrow('SMTP_PASS'),
        },
      });
    } else if (resendKey) {
      this.provider = 'resend';
      this.resend = new Resend(resendKey);
    } else {
      throw new Error('Email provider not configured: set SMTP_HOST or RESEND_API_KEY');
    }
  }

  async send(params: SendEmailParams): Promise<void> {
    if (this.provider === 'smtp') {
      await this.transporter!.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
    } else {
      await this.resend!.emails.send({
        from: this.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
    }
  }
}
