#!/bin/sh

sudo ln -s /var/www/chess/scripts/lightsquared /etc/init.d/lightsquared
sudo update-rc.d lightsquared defaults