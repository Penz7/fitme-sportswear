package vn.fitme.sportswear.common.thirdapp;

public interface TelegramService {
    void sendMessage(String message);
    void sendException(String prefix, Exception e);
}
