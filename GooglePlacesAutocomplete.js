import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  Alert,
  Platform,
  Animated,
  TouchableOpacity,
  Dimensions,
  I18nManager,
  KeyboardAvoidingView,
  ScrollView,StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
import Permissions from 'react-native-permissions';
import isEmpty from 'lodash/isEmpty';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { PROVIDER_GOOGLE,Marker,AnimatedRegion } from 'react-native-maps';
import I18n from 'react-native-i18n';
import {
  saveUserLocation,
  selectCity,
  selectCountry,
  selectNeighborhood
} from 'reduxContainer/actions/settingsActions';
import Icon from 'components/CoreComponents/Icon';
import Button from 'components/CoreComponents/Button';
import { theme } from 'core/theme/GlobalStyles';
import NavigationService from 'services/NavigationService';
import {
  findUserLocation,
  sendAnalyticEvents,
  getUserType,
  setTestID
} from 'helper/utils';
import {
  defaultLocationsByCity,
  EN_COUNTRY_SHORTS
} from 'helper/constants';
import ChangeCityModal from 'components/ChangeCityModal';
import Spinner from 'components/Spinner';
import styled from 'styled-components';
import TypographyStyled from 'core/theme/TypographyStyled';
import {
  selectUserAddress,
  setDefaultVerifyCode
} from 'reduxContainer/actions/userActions';
import Modal from 'react-native-modal';

const screenHeight = Dimensions.get('window').height - StatusBar.currentHeight;

class Map extends Component {
  static async getCurrentLocation(callBack, fail) {
    try {
      Permissions.check('location')
        .then(data => {
          if (data === 'authorized') {
            navigator.geolocation.getCurrentPosition(
              position => {
                callBack({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  error: null
                });
              },
              () => {
                if (fail) fail();
              },
              { timeout: 10000 }
            );
          } else if (fail) fail();
        })
        .catch(() => {
          if (fail) fail();
        });
    } catch (error) {
      if (fail) fail();
    }
  }

  constructor(props) {
    super(props);
    this.handleBackPress = this.handleBackPress.bind(this);
    
    this.state = {
      locationData: {},
      markerAnimation: new Animated.Value(0),
      secondStepPosition: new Animated.Value(-1000),
      mapIsDragged: false,
      loading: false,
      isLocationFound: false,
      delta: Math.exp(Math.log(360) - 18 * Math.LN2),
      isChangeCityModalVisible: false,
      region: {
        latitude:
            defaultLocationsByCity[1].latitude,
          longitude:
            defaultLocationsByCity[1].longitude,
        latitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
        longitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
      }
    };
  }

  componentDidMount() {
    debugger;
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.delay(300),
          Animated.spring(this.state.markerAnimation, {
            toValue: 40,
            tension: 0
          })
        ])
      )
    ]).start();
    if (this.props.onRef) this.props.onRef(this);
    this.setInitialLocation(this.props);
   
  }

  componentWillReceiveProps(nextProps){
    if(this.props.isVisible !== nextProps.isVisible){
      if(nextProps.isVisible){
        this.setInitialLocation(nextProps);
      }
      else{
        if(this.state.showSecondStep){
        this.hideSecondStep();
        }
        this.setState({initialRegion:null});
      }
    }
  }

  componentWillUnmount() {
    if (this.props.onRef) this.props.onRef(undefined);
    if (Platform.OS === 'android') {
      if (this.backHandler) this.backHandler.remove();
    }
  }

  setInitialLocation(props){
    this.setState({loading:true,mapIsDragged:false});
    if (
      props.defaultLocation &&
      props.defaultLocation.latitude &&
      props.defaultLocation.longitude
    ) {
      this.setState({initialRegion:{
        latitude:props.defaultLocation.latitude,
        longitude:props.defaultLocation.longitude,
        latitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
        longitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
      }});
    } else {
      this.setUserLocationIfInServiceArea();
    }
    this.setState({loading:false});
  }

  onRegionChangeComplete = async region => {
      if (this.state.showSecondStep) {
        this.hideSecondStep();
      }
      this.setState({
        locationData: {
          latitude: region.latitude,
          longitude: region.longitude
        },
      });
      this.props.saveUserLocation(region);
  };

  onPanDrag() {
    if (!this.state.mapIsDragged)
      this.setState({ mapIsDragged: true });
  }

  setChangeCityModalVisible(visible) {
    this.setState({ isChangeCityModalVisible: visible });
  }

  setUserLocationIfInServiceArea() {
    Map.getCurrentLocation(
      async location => {
        this.setState({
          isLocationFound: true,
          initialRegion:{
            latitude: location.latitude,
              longitude: location.longitude,
            latitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
            longitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
          }
        });
        this.onPanDrag();
      },
      () => {
        this.setDefaultCityLocation();
      }
    );
  }

  setUserCurrentLocation(){
    Map.getCurrentLocation(
      async location => {
        this.mapView.animateToCoordinate({latitude: location.latitude,
          longitude: location.longitude,
      latitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
      longitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2)});
        this.onPanDrag();
      },
      () => {
        this.mapView.animateToCoordinate({latitude:
          defaultLocationsByCity[this.props.country.id].latitude,
        longitude:
          defaultLocationsByCity[this.props.country.id].longitude,
      latitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
      longitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2)});
      }
    );
  }

  

  setDefaultCityLocation() {
    debugger;
      this.setState({initialRegion:{
        latitude:
            defaultLocationsByCity[this.props.country.id].latitude,
          longitude:
            defaultLocationsByCity[this.props.country.id].longitude,
        latitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
        longitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
      }});
  }

  handleBackPress() {
    let googleAutoCompleteText;
    if (this.googlePlacesAutocomplete) {
      // eslint-disable-next-line no-underscore-dangle
      googleAutoCompleteText = this.googlePlacesAutocomplete.refs.textInput._getText();
    }

    if (googleAutoCompleteText) {
      // eslint-disable-next-line no-underscore-dangle
      this.googlePlacesAutocomplete._handleChangeText('');
    } else if (this.state.showSecondStep) {
      this.hideSecondStep();
    } else if (!isEmpty(this.props.addresses)) {
      this.closeMap();
    } else {
      NavigationService.goBack();
    }

    return true;
  }

  closeMap() {
    this.props.onCloseMap();
  }

  showSecondStep() {
    this.setState({ showSecondStep: true });
    Animated.timing(this.state.secondStepPosition, {
      duration: 300,
      toValue: 0
    }).start();
  }

  hideSecondStep() {
    this.setState({ showSecondStep: false });
    Animated.timing(this.state.secondStepPosition, {
      duration: 300,
      toValue: -1000
    }).start();
  }

  render() {
    const interpolation = this.state.markerAnimation.interpolate({
      inputRange: [0, 40],
      outputRange: [0.5, 0]
    });

    const asd=(!this.props.defaultLocation ||
      !this.props.defaultLocation.latitude ||
      !this.props.defaultLocation.longitude) &&
    !this.state.mapIsDragged &&
    !this.state.isLocationFound;
    debugger;

    return (
      <Modal
        hasBackdrop={false}
        id="map-modal"
        isVisible={this.props.isVisible}
        style={{
          flex: 1,
          marginLeft: 0,
          marginRight: 0,
          marginBottom: 0,
          marginTop: 0,
          borderRadius: 8,
          backgroundColor:"rgba(0,0,0,0.01)"
        }}
        onModalHide={() => {
          if (this.state.navigateToWelcomePage) {
            NavigationService.navigateAndReset('WELCOME_PAGE');
          }
        }}
      >
         <KeyboardAvoidingView
            behavior={undefined}
            pointerEvents="box-none"
          >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{height:screenHeight,paddingTop:this.props.safeAreaHeight.top}} keyboardShouldPersistTaps="always">
        <Spinner loading={this.state.loading} id="spinner" />
        <TouchableArea
          activeOpacity={0.5}
          onPress={() => this.props.onCloseMap()}
        />
        {this.state.isChangeCityModalVisible ? (
          <ChangeCityModal
            id="change-city-modal"
            safeAreaHeight={this.props.safeAreaHeight}
            cityName={
              this.props.selectedCity && this.props.selectedCity.name
            }
            nextCityName={
              this.state.nextCity && this.state.nextCity.name
            }
            onClose={() =>
              this.setState({ isChangeCityModalVisible: false })
            }
            onPress={async () => {
              if (
                this.props.country.id !== this.state.nextCountry.id
              ) {
                this.props.setDefaultVerifyCode();
                try {
                  AsyncStorage.removeItem('code').then(() => {});
                } catch (e) {
                  console.log(e);
                }

                this.props.selectNeighborhood(
                  this.state.locationData
                );

                this.props.countries.forEach(country => {
                  if (country.id === this.state.nextCountry.id) {
                    this.props.selectCountry(country);
                  }
                });
              }

              this.props.selectCity({
                id: this.state.nextCity.id,
                title: this.state.nextCity.name,
                name: this.state.nextCity.name
              });

              this.setChangeCityModalVisible(false);
              this.setState({
                navigateToWelcomePage: true
              });
            }}
          />
        ) : null}

        <MapModalContent>
          {this.state.initialRegion ? <MapView
          ref={(ref)=>this.mapView=ref}
            initialRegion={this.state.initialRegion}
            id="map-view"
            showsIndoorLevelPicker={false}
            provider={PROVIDER_GOOGLE}
            style={mapViewStyle}
            showsBuildings={false}
            showsTraffic={false}
            onRegionChangeComplete={this.onRegionChangeComplete}
            onPanDrag={() => this.onPanDrag()}
          /> : null}
          {!this.props.defaultLocation && !this.state.mapIsDragged ? (
            <MoveMapContainer id="move_map_text">
              <MoveMapSubContainer>
                <CaptionWhiteCenter>
                  {I18n.t('move_the_map')}
                </CaptionWhiteCenter>
              </MoveMapSubContainer>
            </MoveMapContainer>
          ) : null}
          <MarkerContainer id="marker" pointerEvents="none">
            <Icon
              name="marker"
              width={40}
              height={40}
              fill="#e50027"
            />
            <MarkerAnimationContainer pointerEvents="none">
              <Animated.View
                style={{
                  width: this.state.markerAnimation,
                  height: this.state.markerAnimation,
                  opacity: interpolation,
                  ...markerAnimationStyle
                }}
              />
            </MarkerAnimationContainer>
          </MarkerContainer>

          {this.state.showSecondStep ? null : (
            <ConfirmButtonContainer>
              <Button
                disabled={
                  (!this.props.defaultLocation ||
                    !this.props.defaultLocation.latitude ||
                    !this.props.defaultLocation.longitude) &&
                  !this.state.mapIsDragged &&
                  !this.state.isLocationFound
                }
                id="map_button_confirm"
                text={I18n.t('confirm')}
                onPress={async () => {
                  this.setState({ loading: true });
                  const locationData = await findUserLocation(
                    this.state.mapIsDragged
                      ? this.state.locationData.latitude
                      : this.props.defaultLocation.latitude,
                    this.state.mapIsDragged
                      ? this.state.locationData.longitude
                      : this.props.defaultLocation.longitude,
                    this.props.serviceType
                  );

                  this.setState({
                    loading: false
                  });
                  if (locationData.error) {
                    sendAnalyticEvents(
                      'Mobile_Contact_Confirm_Clicked',
                      {
                        mobileContactConfirmClickedCustomerType: getUserType(
                          this.props.user.user_type
                        ),
                        mobileContactConfirmClickedCity: this.props
                          .selectedCity.name,
                        mobileContactConfirmClickedError:
                          locationData.error,
                        mobileContactConfirmClickedCoordinates: `${this.state.locationData.latitude},${this.state.locationData.longitude}`,
                        mobileContactConfirmClickedNeighborhood: this
                          .state.locationData.neighborhood
                      }
                    );

                    return Alert.alert('', locationData.error);
                  }

                  if (
                    this.props.addresses.length < 1 &&
                    !this.props.isNewUser
                  ) {
                    this.props.selectCountry(locationData.country);
                    this.props.selectCity({
                      id: locationData.city.id,
                      title: locationData.city.name,
                      name: locationData.city.name
                    });

                    

                    this.props.selectNeighborhood(locationData);
                    this.closeMap();
                    NavigationService.navigateAndReset(
                      'WELCOME_PAGE'
                    );
                  } else {
                    if (
                      !this.props.changeCityAuto &&
                      locationData.country.id !==
                        this.props.country.id
                    ) {
                      return this.setState(
                        {
                          nextCountry: locationData.country,
                          nextCity: locationData.city
                        },
                        () => this.setChangeCityModalVisible(true)
                      );
                    }
                    if (
                      !this.props.changeCityAuto &&
                      locationData.city.id !==
                        this.props.selectedCity.id
                    ) {
                      return this.setState(
                        {
                          nextCity: locationData.city,
                          nextCountry: locationData.country
                        },
                        () => this.setChangeCityModalVisible(true)
                      );
                    }
                    this.props.saveUserLocation(locationData);
                  }

                  if (this.props.onPressConfirm) {
                    this.props.onPressConfirm();
                  }

                  sendAnalyticEvents(
                    'Mobile_Contact_Confirm_Clicked',
                    {
                      mobileContactConfirmClickedCustomerType: getUserType(
                        this.props.user.user_type
                      ),
                      mobileContactConfirmClickedCity:
                        locationData.city.name,
                      mobileContactConfirmClickedError: '',
                      mobileContactConfirmClickedCoordinates: `${locationData.latitude},${locationData.longitude}`,
                      mobileContactConfirmClickedNeighborhood:
                        locationData.neighborhood
                    }
                  );
                  if (this.props.showSecondStep) {
                    this.showSecondStep();
                  } else {
                    this.closeMap();
                  }
                }}
                style={{ width: '100%' }}
              />
            </ConfirmButtonContainer>
          )}
          <GetUserLocationButton
            id="user-location-button"
            {...setTestID('get_user_location')}
            activeOpacity={0.9}
            onPress={() => {
              this.setUserCurrentLocation();
            }}
          >
            <LocationIconContainer style={locationIconShadow}>
              <Icon name="location" />
            </LocationIconContainer>
          </GetUserLocationButton>
          {this.props.secondStep && (
            <Animated.View
              style={{
                bottom: this.state.secondStepPosition,
                ...downArrowContainerStyle
              }}
            >
              <DownArrowButton onPress={() => this.handleBackPress()}>
                <Icon name="downArrow" />
              </DownArrowButton>
              {this.state.showSecondStep
                ? this.props.secondStep
                : null}
            </Animated.View>
          )}
          <AutoCompleteContainer>
            <GooglePlacesAutocomplete
              latitude={this.state.region.latitude}
              longitude={this.state.region.longitude}
              id="google-places-auto-complete"
              ref={c => (this.googlePlacesAutocomplete = c)}
              placeholder={I18n.t('search_for_your_building_or_area')}
              minLength={2} // minimum length of text to search
              autoFocus={false}
              returnKeyType="search" // Can be left out for default return key https://facebook.github.io/react-native/docs/textinput.html#returnkeytype
              keyboardAppearance="light" // Can be left out for default keyboardAppearance https://facebook.github.io/react-native/docs/textinput.html#keyboardappearance
              listViewDisplayed="auto" // true/false/undefined
              fetchDetails
              showsMyLocationButton
              renderLeftButton={() => (
                <TouchableOpacity
                hitSlop={{left:10,right:10,bottom:20,top:20}}
                  style={{ flexDirection: 'row' }}
                  onPress={() => {
                    if (!this.props.onboarding) {
                      this.closeMap();
                      this.handleBackPress();
                    }
                  }}
                >
                  <Icon
                    name={this.props.onboarding ? 'search' : 'back'}
                    fill={
                      this.props.onboarding
                        ? theme.color.black87
                        : theme.color.black12
                    }
                    arabicSupport
                  />
                </TouchableOpacity>
              )}
              renderDescription={row => row.description} // custom description render
              onPress={(data, details = null) => {
                // 'details' is provided when fetchDetails = true
                if (this.state.showSecondStep) this.hideSecondStep();
                this.setState({ mapIsDragged: true });
                // eslint-disable-next-line no-underscore-dangle
                this.googlePlacesAutocomplete._handleChangeText('');
                  this.mapView.animateToCoordinate({latitude: details.geometry.location.lat,
                    longitude: details.geometry.location.lng,
                    latitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),
                    longitudeDelta: Math.exp(Math.log(360) - 18 * Math.LN2),});
              }}
              getDefaultValue={() => ''}
              filterSearch={this.props.filterSearch}
              query={{
                // available options: https://developers.google.com/places/web-service/autocomplete
                key:
                  Platform.OS === 'ios'
                    ? 'AIzaSyBsTgESedscsR4iWSHdC1F5QvZnXxnuwzg'
                    : 'AIzaSyDKFElREF5wKu_IoDotxrEqjM3NYeKKFJg',
                language: 'en',
                components: !this.props.filterSearch
                  ? ''
                  : `country:${
                      EN_COUNTRY_SHORTS[this.props.country.id]
                    }`
              }}
              styles={autoCompleteStyle}
              nearbyPlacesAPI="GooglePlacesSearch" // Which API to use: GoogleReverseGeocoding or GooglePlacesSearch
              GoogleReverseGeocodingQuery={
                {
                  // available options for GoogleReverseGeocoding API : https://developers.google.com/maps/documentation/geocoding/intro
                }
              }
              GooglePlacesSearchQuery={{
                // available options for GooglePlacesSearch API : https://developers.google.com/places/web-service/search
                rankby: 'distance',
                type: 'cafe'
              }}
              GooglePlacesDetailsQuery={{
                fields: 'formatted_address'
              }}
              filterReverseGeocodingByTypes={[
                'locality',
                'administrative_area_level_3'
              ]}
              debounce={200}
            />
          </AutoCompleteContainer>
        </MapModalContent>
        </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
}

Map.defaultProps = {
  safeAreaHeight: { top: 0, left: 0, right: 0, bottom: 0 }
};

function mapStateToProps(state) {
  return {
    phone_placeholder: state.settings.funnel.phone_placeholder,
    phone_regex: state.settings.funnel.phone_regex,
    funnel: state.settings.funnel,
    cities: state.settings.cities,
    country: state.settings.country,
    selectedCity: state.settings.selectedCity,
    address: state.settings.address,
    phone: state.settings.phone,
    getAddressesIsLoading: state.user.getAddressesIsLoading,
    user: state.user.user,
    safeAreaHeight: state.settings.safeAreaHeight,
    addresses: state.user.addresses,
    countries: state.settings.countries,
    serviceType: state.settings.serviceType
  };
}

export default connect(
  mapStateToProps,
  {
    saveUserLocation,
    selectCity,
    selectCountry,
    setDefaultVerifyCode,
    selectUserAddress,
    selectNeighborhood
  }
)(Map);

const mapViewStyle = {
  flex: 1,
  borderRadius: 8
};

const TouchableArea = styled.TouchableOpacity`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: black;
  opacity: 0.5;
`;

const autoCompleteStyle = {
  container: {
    backgroundColor: 'transparent'
  },
  textInputContainer: {
    marginLeft: 16,
    marginRight: 16,
    borderRadius: 4,
    shadowColor: theme.color.black12,
    borderWidth: 1,
    borderColor: theme.color.black12,
    shadowOffset: {
      width: 0,
      height: 0
    },
    shadowRadius: 10,
    shadowOpacity: 1
  },
  textInput: {
    height: 48,
    borderRadius: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left'
  },
  description: {
    fontWeight: 'bold'
  },
  listView: { backgroundColor: 'white' },
  predefinedPlacesDescription: {
    color: '#1faadb'
  }
};

const MapModalContent = styled.View`
  flex: 1;
  background-color: transparent;
`;
const ConfirmButtonContainer = styled.View`
  position: absolute;
  bottom: 24px;
  right: 24px;
  left: 24px;
`;

const CaptionWhiteCenter = styled.Text`
  ${TypographyStyled.captionWhiteCenter};
`;

const MoveMapContainer = styled.View`
  left: 0px;
  right: 0px;
  align-items: center;
  margin-top: -90px;
  position: absolute;
  top: 50%;
`;

const MoveMapSubContainer = styled.View`
  width: 260px;
  height: 36px;
  border-radius: 4px;
  background-color: ${theme.color.alternateDark};
  align-items: center;
  justify-content: center;
`;

const MarkerContainer = styled.View`
  left: 50%;
  margin-left: -20px;
  margin-top: -40px;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 50%;
`;

const markerAnimationStyle = {
  backgroundColor: 'gray',
  borderRadius: 30,
  bottom: -20,
  left: -10
};
const MarkerAnimationContainer = styled.View`
  position: absolute;
  left: 0px;
  right: 0px;
  width: 60px;
  height: 60px;
  align-items: center;
  justify-content: center;
`;

const locationIconShadow = {
  shadowColor: theme.color.black12,
  shadowOffset: {
    width: 0,
    height: 0
  },
  shadowRadius: 0,
  shadowOpacity: 1,
  elevation: 4
};

const GetUserLocationButton = styled.TouchableOpacity`
  position: absolute;
  bottom: 100;
  right: 20;
`;

const LocationIconContainer = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 196px;
  background-color: ${theme.color.white};
  justify-content: center;
  align-items: center;
`;

const downArrowContainerStyle = {
  paddingBottom: 24,
  position: 'absolute',
  left: 0,
  right: 0,
  backgroundColor: 'white',
  shadowColor: theme.color.black8,
  shadowOffset: {
    width: 0,
    height: 16
  },
  shadowRadius: 24,
  shadowOpacity: 1
};

const DownArrowButton = styled.TouchableOpacity`
  justify-content: center;
  align-items: center;
  height: 40;
`;

const AutoCompleteContainer = styled.View`
  position: absolute;
  left: 0px;
  right: 0px;
`;
