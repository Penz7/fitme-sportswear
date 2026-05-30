package vn.fitme.sportswear.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.context.annotation.Bean;

@Configuration
@EnableScheduling
public class SchedulerConfig {

  @Bean
  public ThreadPoolTaskScheduler taskScheduler() {
    ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
    scheduler.setPoolSize(20); // 10 threads
    scheduler.setThreadNamePrefix("MyScheduler-");
    scheduler.initialize();
    return scheduler;
  }
}
