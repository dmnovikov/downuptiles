package com.downuptiles.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // AppCompat reads the theme during super.onCreate. The launch/splash
        // theme must be replaced before then, otherwise it creates a title bar.
        setTheme(R.style.AppTheme_NoActionBar);
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
    }
}
